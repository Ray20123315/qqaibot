using System.Diagnostics;
using System.Drawing;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace QQAIBOT_CodexBridge;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        // A headless CI check validates that the native desktop entrypoint can
        // instantiate its controls without launching Codex or reading secrets.
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
        {
            using var form = new MainForm(autoConnect: false);
            return form.Controls.Count > 0 && form.Text.Contains("QQAIBOT") ? 0 : 3;
        }
        Application.Run(new MainForm(autoConnect: true));
        return 0;
    }
}

internal sealed class MainForm : Form
{
    private static readonly Color Base = Color.FromArgb(18, 22, 33);
    private static readonly Color Panel = Color.FromArgb(28, 34, 48);
    private static readonly Color Fore = Color.FromArgb(236, 241, 250);
    private static readonly Color Muted = Color.FromArgb(155, 169, 190);
    private static readonly Color Accent = Color.FromArgb(86, 150, 248);
    private readonly string _configPath;
    private readonly string _logPath;
    private readonly bool _autoConnect;
    private readonly TextBox _url = new();
    private readonly TextBox _token = new();
    private readonly TextBox _codex = new();
    private readonly TextBox _events = new();
    private readonly Label _status = new();
    private readonly Label _hint = new();
    private readonly Button _start = new();
    private readonly Button _stop = new();
    private readonly NotifyIcon _tray = new();
    private Process? _bridge;
    private bool _closing;
    private bool _running;
    private int _lineCount;

    public MainForm(bool autoConnect)
    {
        _autoConnect = autoConnect;
        _configPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "QQAIBOT", "codex-bridge.json");
        _logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "QQAIBOT", "logs", "codex-bridge.log");
        Text = "QQAIBOT · Codex Bridge";
        Width = 700;
        Height = 660;
        MinimumSize = new Size(650, 600);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Base;
        ForeColor = Fore;
        Font = new Font("Microsoft JhengHei UI", 10F);
        FormBorderStyle = FormBorderStyle.Sizable;
        Icon = SystemIcons.Application;
        BuildUi();
        LoadSettings();

        _tray.Icon = Icon;
        _tray.Text = "QQAIBOT Codex Bridge";
        _tray.Visible = true;
        _tray.DoubleClick += (_, _) => RestoreWindow();
        var trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("開啟控制台", null, (_, _) => RestoreWindow());
        trayMenu.Items.Add("結束", null, (_, _) => Close());
        _tray.ContextMenuStrip = trayMenu;
        Resize += (_, _) =>
        {
            if (WindowState != FormWindowState.Minimized || _closing) return;
            Hide();
            _tray.ShowBalloonTip(1000, "QQAIBOT", "已縮小至系統匣，Bridge 保持連線。", ToolTipIcon.Info);
        };
        FormClosing += (_, _) =>
        {
            _closing = true;
            StopBridge();
            _tray.Visible = false;
            _tray.Dispose();
        };
        Shown += (_, _) =>
        {
            AddEvent("視窗已啟動。此程式是 Windows GUI，背景 Codex Bridge 才是命令列工作程序。");
            if (_autoConnect && HasValidSettings()) BeginInvoke((Action)StartBridge);
        };
    }

    private static Label Label(string text, float size = 10, Color? color = null)
        => new() { Text = text, ForeColor = color ?? Fore, AutoSize = false, Font = new Font("Microsoft JhengHei UI", size, size > 12 ? FontStyle.Bold : FontStyle.Regular), TextAlign = ContentAlignment.MiddleLeft };

    private static Button Button(string text, Color background)
        => new() { Text = text, BackColor = background, ForeColor = Fore, FlatStyle = FlatStyle.Flat, Height = 38, Cursor = Cursors.Hand, UseVisualStyleBackColor = false };

    private void BuildUi()
    {
        var page = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(25, 18, 25, 18),
            BackColor = Base, ColumnCount = 1, RowCount = 6
        };
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 194));
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 55));
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
        page.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        Controls.Add(page);

        var header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
        header.RowStyles.Add(new RowStyle(SizeType.Absolute, 35));
        header.Controls.Add(Label("QQAIBOT  /  Codex Bridge", 18), 0, 0);
        header.Controls.Add(Label("Windows 圖形控制台 · Luna non-think · 設定儲存在本機", 9, Muted), 0, 1);
        page.Controls.Add(header, 0, 0);

        var stat = new Panel { Dock = DockStyle.Fill, BackColor = Panel, Padding = new Padding(12, 4, 12, 4) };
        _status.Dock = DockStyle.Top;
        _status.Height = 26;
        _status.ForeColor = Accent;
        _status.Text = "尚未連線";
        _status.Font = new Font("Microsoft JhengHei UI", 12, FontStyle.Bold);
        _hint.Dock = DockStyle.Bottom;
        _hint.Height = 19;
        _hint.Text = "只有 WebSocket 連線且 CLI 登入後才能實際回覆 QQ 訊息。";
        _hint.ForeColor = Muted;
        _hint.Font = new Font("Microsoft JhengHei UI", 8);
        stat.Controls.Add(_status);
        stat.Controls.Add(_hint);
        page.Controls.Add(stat, 0, 1);

        var fields = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(12, 8, 12, 8), BackColor = Panel, ColumnCount = 2, RowCount = 4 };
        fields.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 112));
        fields.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 41));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 41));
        fields.RowStyles.Add(new RowStyle(SizeType.Absolute, 41));
        fields.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        InitField(fields, 0, "Worker 網址", _url);
        InitField(fields, 1, "Bridge Token", _token);
        _token.UseSystemPasswordChar = true;
        InitField(fields, 2, "Codex CLI", _codex);
        var p = Label("Token 僅保存在你的 Windows 設定檔，不會在畫面或診斷紀錄顯示。", 9, Muted);
        p.Dock = DockStyle.Fill;
        fields.SetColumnSpan(p, 2);
        fields.Controls.Add(p, 0, 3);
        page.Controls.Add(fields, 0, 2);

        var controls = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight, AutoScroll = true };
        _start.Text = "啟動連線";
        StyleButton(_start, Accent);
        _start.Click += (_, _) => StartBridge();
        _stop.Text = "停止連線";
        StyleButton(_stop, Color.FromArgb(69, 79, 97));
        _stop.Enabled = false;
        _stop.Click += (_, _) => StopBridge();
        var save = Button("儲存設定", Color.FromArgb(51, 76, 109));
        save.Width = 112;
        save.Click += (_, _) => SaveSettings(showSuccess: true);
        var advanced = Button("進階設定", Color.FromArgb(51, 59, 77));
        advanced.Width = 112;
        advanced.Click += (_, _) => OpenInNotepad(_configPath);
        controls.Controls.AddRange([_start, _stop, save, advanced]);
        page.Controls.Add(controls, 0, 3);

        var eventLabel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
        eventLabel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        eventLabel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 112));
        eventLabel.Controls.Add(Label("連線與診斷資訊", 11), 0, 0);
        var logButton = Button("開啟日誌", Color.FromArgb(51, 59, 77));
        logButton.Width = 112;
        logButton.Height = 32;
        logButton.Click += (_, _) => OpenInNotepad(_logPath);
        eventLabel.Controls.Add(logButton, 1, 0);
        page.Controls.Add(eventLabel, 0, 4);

        _events.Dock = DockStyle.Fill;
        _events.Multiline = true;
        _events.ReadOnly = true;
        _events.ScrollBars = ScrollBars.Vertical;
        _events.BackColor = Panel;
        _events.ForeColor = Fore;
        _events.BorderStyle = BorderStyle.None;
        _events.Font = new Font("Consolas", 9.5F);
        _events.Margin = new Padding(0, 2, 0, 0);
        page.Controls.Add(_events, 0, 5);
    }

    private static void InitField(TableLayoutPanel container, int row, string name, TextBox input)
    {
        var label = Label(name);
        label.Dock = DockStyle.Fill;
        container.Controls.Add(label, 0, row);
        input.Dock = DockStyle.Fill;
        input.BackColor = Color.FromArgb(39, 46, 62);
        input.ForeColor = Fore;
        input.BorderStyle = BorderStyle.FixedSingle;
        input.Margin = new Padding(0, 8, 0, 6);
        container.Controls.Add(input, 1, row);
    }

    private static void StyleButton(Button button, Color color)
    {
        button.Width = 112;
        button.Height = 38;
        button.BackColor = color;
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderSize = 0;
        button.ForeColor = Fore;
    }

    private static JsonObject ParseOrCreateSettings(string path)
    {
        if (!File.Exists(path)) return new JsonObject();
        var parsed = JsonNode.Parse(File.ReadAllText(path, Encoding.UTF8));
        return parsed as JsonObject ?? throw new InvalidDataException("設定檔必須是 JSON 物件。");
    }

    private void LoadSettings()
    {
        try
        {
            var cfg = ParseOrCreateSettings(_configPath);
            _url.Text = cfg["bridgeUrl"]?.GetValue<string>() ?? "wss://aibot.ray2025.com/v3/codex-bridge";
            _token.Text = cfg["bridgeToken"]?.GetValue<string>() ?? "";
            _codex.Text = cfg["codexBin"]?.GetValue<string>() ?? "codex";
            if (string.IsNullOrWhiteSpace(_token.Text)) _hint.Text = "首次使用：請填入原有 Bridge Token，按「儲存設定」，再啟動連線。";
        }
        catch
        {
            _url.Text = "wss://aibot.ray2025.com/v3/codex-bridge";
            _codex.Text = "codex";
            SetStatus("設定檔格式有誤", true);
            AddEvent("設定檔不是有效的 JSON；請使用「進階設定」修正，原檔案未被覆蓋。");
        }
    }

    private bool HasValidSettings()
        => Uri.TryCreate(_url.Text.Trim(), UriKind.Absolute, out var uri)
        && uri.Scheme == "wss" && !string.IsNullOrWhiteSpace(_token.Text)
        && !string.IsNullOrWhiteSpace(_codex.Text);

    private bool SaveSettings(bool showSuccess)
    {
        if (!HasValidSettings())
        {
            SetStatus("設定尚未完成", true);
            AddEvent("請填入 wss:// 網址、原有 Bridge Token 和 Codex CLI 位置。");
            return false;
        }
        try
        {
            // Modify only controlled fields; preserve all existing read/edit roots
            // and configuration for privileged CodexWork file access.
            var cfg = ParseOrCreateSettings(_configPath);
            cfg["bridgeUrl"] = _url.Text.Trim();
            cfg["bridgeToken"] = _token.Text;
            cfg["codexBin"] = _codex.Text.Trim();
            Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);
            var temporary = _configPath + ".tmp-" + Guid.NewGuid().ToString("N");
            File.WriteAllText(temporary, cfg.ToJsonString(new JsonSerializerOptions { WriteIndented = true }), new UTF8Encoding(false));
            File.Move(temporary, _configPath, true);
            if (showSuccess) AddEvent("設定已安全儲存至本機，不會上傳或顯示 Token。");
            return true;
        }
        catch
        {
            SetStatus("無法儲存設定", true);
            AddEvent("設定檔可能無法寫入或 JSON 已損壞；請先使用「進階設定」檢查。");
            return false;
        }
    }

    private void StartBridge()
    {
        if (_bridge is { HasExited: false }) return;
        if (!SaveSettings(showSuccess: false)) return;
        var backend = Path.Combine(AppContext.BaseDirectory, "QQAIBOT-CodexBridge-Backend.exe");
        if (!File.Exists(backend))
        {
            SetStatus("找不到 Bridge 後端", true);
            AddEvent("請完整解壓 ZIP，GUI 和 QQAIBOT-CodexBridge-Backend.exe 必須放在同一資料夾。");
            return;
        }
        try
        {
            var info = new ProcessStartInfo(backend)
            {
                Arguments = "--run --config \"" + _configPath.Replace("\"", "") + "\"",
                WorkingDirectory = AppContext.BaseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            _bridge = new Process { StartInfo = info, EnableRaisingEvents = true };
            _bridge.OutputDataReceived += (_, e) => OnBackendLine(e.Data);
            _bridge.ErrorDataReceived += (_, e) => OnBackendLine(e.Data);
            _bridge.Exited += (_, _) => PostToUi(() =>
            {
                if (_closing) return;
                _running = false;
                _start.Enabled = true;
                _stop.Enabled = false;
                SetStatus("連線已停止", true);
                AddEvent("Bridge 後端已結束；請查看安全診斷資訊。");
            });
            _bridge.Start();
            _bridge.BeginOutputReadLine();
            _bridge.BeginErrorReadLine();
            _running = true;
            _start.Enabled = false;
            _stop.Enabled = true;
            SetStatus("正在建立連線...");
            AddEvent("已啟動 Bridge 後端，等待 Cloudflare WebSocket 回應。");
        }
        catch
        {
            SetStatus("無法啟動 Bridge 後端", true);
            AddEvent("Windows 無法啟動後端執行檔；請確認兩個 EXE 都已解壓且未被防毒封鎖。");
            _bridge?.Dispose();
            _bridge = null;
        }
    }

    private void OnBackendLine(string? line)
    {
        if (line is null) return;
        // Never show arbitrary stderr/stdout: Codex CLI errors could contain
        // input, API credentials, or local file paths.
        if (!line.StartsWith("[QQAIBOT] ", StringComparison.Ordinal)) return;
        var sanitized = line[10..].Trim();
        // Backend emits translated fixed status labels only.
        var allowed = new[] { "正在啟動", "找不到設定檔", "設定檔格式錯誤", "尚未設定 Bridge Token",
            "設定檢查通過", "正在連線 QQ AI Cloudflare", "WebSocket 已連線",
            "Worker 已回應握手", "WebSocket 已斷線", "發生錯誤",
            "找不到可執行的 Codex CLI", "Codex CLI 可執行" };
        if (!allowed.Any(a => sanitized.StartsWith(a, StringComparison.Ordinal))) return;
        var code = sanitized.Contains("HTTP_401", StringComparison.Ordinal) ? "HTTP 401：Bridge Token 不正確" :
                   sanitized.Contains("HTTP_403", StringComparison.Ordinal) ? "HTTP 403：無權限" : "";
        PostToUi(() =>
        {
            AddEvent(code.Length > 0 ? code : sanitized.Split('(')[0].Trim());
            if (sanitized.StartsWith("Worker 已回應握手")) SetStatus("已連線 · Worker 握手成功");
            else if (sanitized.StartsWith("WebSocket 已連線")) SetStatus("WebSocket 已連線");
            else if (sanitized.StartsWith("WebSocket 已斷線")) SetStatus("正在重新連線...");
            else if (code.Length > 0) SetStatus(code, true);
            else if (sanitized.StartsWith("找不到可執行的 Codex CLI")) SetStatus("找不到 Codex CLI", true);
        });
    }

    private void StopBridge()
    {
        if (!_running && _bridge is null) return;
        _running = false;
        try { if (_bridge is { HasExited: false }) _bridge.Kill(entireProcessTree: true); }
        catch { /* already stopped */ }
        _bridge?.Dispose();
        _bridge = null;
        if (_closing) return;
        _start.Enabled = true;
        _stop.Enabled = false;
        SetStatus("已停止");
        AddEvent("已停止 Codex Bridge。");
    }

    private void PostToUi(Action action)
    {
        if (_closing || IsDisposed || !IsHandleCreated) return;
        try { BeginInvoke(action); } catch (InvalidOperationException) { }
    }

    private void SetStatus(string status, bool warning = false)
    {
        _status.Text = status;
        _status.ForeColor = warning ? Color.FromArgb(255, 184, 100) : Accent;
    }

    private void AddEvent(string message)
    {
        if (_closing) return;
        var line = "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message;
        if (++_lineCount > 80)
        {
            var lines = _events.Lines;
            _events.Lines = lines.Skip(Math.Max(0, lines.Length - 55)).ToArray();
            _lineCount = _events.Lines.Length;
        }
        _events.AppendText(line + Environment.NewLine);
    }

    private static void OpenInNotepad(string path)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            if (!File.Exists(path))
                File.WriteAllText(path, path.EndsWith(".json", StringComparison.OrdinalIgnoreCase) ? "{}" : "", Encoding.UTF8);
            Process.Start(new ProcessStartInfo("notepad.exe", "\"" + path + "\"") { UseShellExecute = true });
        }
        catch { MessageBox.Show("無法開啟檔案，請在 Windows 檔案總管手動開啟。", "QQAIBOT"); }
    }

    private void RestoreWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }
}
