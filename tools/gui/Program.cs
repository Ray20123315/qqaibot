using System.Diagnostics;
using System.Drawing;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace QQAIBOT.CodexBridge;

// A real native WinForms GUI. The existing Codex Bridge engine remains a
// separate, hidden child process, never an interactive CLI users must operate.
internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Contains("--self-test", StringComparer.OrdinalIgnoreCase))
        {
            using var form = new BridgeWindow();
            bool valid = form.Text.Contains("QQAIBOT") && form.Controls.Count > 0
                && form.HasConnectionControls;
            Console.WriteLine(valid ? "GUI_SELF_TEST_OK" : "GUI_SELF_TEST_FAILED");
            return valid ? 0 : 3;
        }
        Application.Run(new BridgeWindow());
        return 0;
    }
}
internal sealed class BridgeWindow : Form
{
    private const string DefaultUrl = "wss://aibot.ray2025.com/v3/codex-bridge";
    private readonly string configPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "QQAIBOT", "codex-bridge.json");
    private readonly string logPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "QQAIBOT", "logs", "codex-bridge.log");
    private readonly Color background = Color.FromArgb(14, 19, 31);
    private readonly Color panel = Color.FromArgb(23, 31, 48);
    private readonly Color foreground = Color.FromArgb(224, 234, 248);
    private readonly Color muted = Color.FromArgb(151, 169, 192);
    private readonly Color accent = Color.FromArgb(88, 187, 244);
    private TextBox url = null!, token = null!, codex = null!, readRoot = null!, log = null!;
    private CheckBox editAllowed = null!, showToken = null!;
    private Label state = null!, detail = null!;
    private Button start = null!, stop = null!;
    private Process? engine;
    private bool shuttingDown;
    private bool configInvalid;
    public bool HasConnectionControls => url is not null && token is not null && start is not null && stop is not null;

    public BridgeWindow()
    {
        Text = "QQAIBOT · Codex Bridge";
        Font = new Font("Microsoft JhengHei UI", 10.5F, FontStyle.Regular);
        Size = new Size(980, 690);
        MinimumSize = new Size(820, 590);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = background;
        ForeColor = foreground;
        FormBorderStyle = FormBorderStyle.Sizable;
        AutoScaleMode = AutoScaleMode.Dpi;
        BuildUi();
        LoadSettings();
        ShowStatus("尚未連線", "在「連線設定」儲存 Token，再按「啟動連線」。", false);
        FormClosing += (_, _) => { shuttingDown = true; StopEngine(); };
    }

    private Label Label(string value, int x, int y, int width, float size = 10.5F, bool bold = false)
    {
        return new Label { Text = value, Left = x, Top = y, Width = width, Height = 32,
            Font = new Font("Microsoft JhengHei UI", size, bold ? FontStyle.Bold : FontStyle.Regular),
            ForeColor = bold ? foreground : muted, BackColor = Color.Transparent };
    }
    private Button Button(string value, int x, int y, int width, EventHandler handler, bool primary = false)
    {
        var b = new Button { Text = value, Left = x, Top = y, Width = width, Height = 39,
            FlatStyle = FlatStyle.Flat, BackColor = primary ? accent : Color.FromArgb(34, 45, 65),
            ForeColor = primary ? Color.FromArgb(11, 24, 40) : foreground, Cursor = Cursors.Hand };
        b.FlatAppearance.BorderSize = 0;
        b.Click += handler;
        return b;
    }
    private TextBox Input(int x, int y, int width, bool password = false)
    {
        return new TextBox { Left = x, Top = y, Width = width, Height = 35,
            Font = new Font("Consolas", 10.5F), UseSystemPasswordChar = password,
            BackColor = Color.FromArgb(32, 42, 59), ForeColor = foreground,
            BorderStyle = BorderStyle.FixedSingle };
    }
    private void BuildUi()
    {
        var header = new Panel { Dock = DockStyle.Top, Height = 94, BackColor = panel };
        header.Controls.Add(Label("QQAIBOT", 30, 15, 600, 21, true));
        header.Controls.Add(Label("Codex Bridge · Windows 桌面控制台", 30, 52, 720, 11));
        Controls.Add(header);

        var tabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(20, 9), Font = new Font("Microsoft JhengHei UI", 10.5F) };
        var dashboard = NewTab("總覽", tabs), configuration = NewTab("連線設定", tabs);
        var permissions = NewTab("資料夾權限", tabs), diagnostics = NewTab("診斷日誌", tabs);
        Controls.Add(tabs);
        tabs.BringToFront();
        header.BringToFront();

        dashboard.Controls.Add(Label("連線狀態", 32, 37, 650, 15, true));
        state = Label("尚未連線", 32, 90, 750, 22, true);
        state.ForeColor = accent;
        dashboard.Controls.Add(state);
        detail = Label("", 32, 154, 800);
        detail.Height = 70;
        detail.AutoSize = false;
        dashboard.Controls.Add(detail);
        start = Button("啟動連線", 34, 250, 190, async (_, _) => await StartEngine(), true);
        stop = Button("停止連線", 240, 250, 165, (_, _) => StopEngine());
        dashboard.Controls.Add(start);
        dashboard.Controls.Add(stop);
        dashboard.Controls.Add(Label("模型偏好：GPT-6 Luna · non-think（需本機 Codex CLI 支援）", 32, 335, 790));
        dashboard.Controls.Add(Label("EXE 線上時優先使用 Codex；斷線時 Worker 回退 Gemini。", 32, 372, 790));
        dashboard.Controls.Add(Label("此 GUI 不會修改 Cloudflare 的任何金鑰。", 32, 409, 790));

        configuration.Controls.Add(Label("Worker WebSocket 位址", 32, 36, 700));
        url = Input(34, 78, 730); configuration.Controls.Add(url);
        configuration.Controls.Add(Label("Bridge Token（只儲存在本機設定檔）", 32, 135, 710));
        token = Input(34, 178, 730, true); configuration.Controls.Add(token);
        showToken = new CheckBox { Text = "暫時顯示 Token", Left = 35, Top = 225, Width = 240,
            BackColor = Color.Transparent, ForeColor = muted };
        showToken.CheckedChanged += (_, _) => token.UseSystemPasswordChar = !showToken.Checked;
        configuration.Controls.Add(showToken);
        configuration.Controls.Add(Label("Codex CLI 執行路徑", 32, 272, 710));
        codex = Input(34, 315, 620); configuration.Controls.Add(codex);
        configuration.Controls.Add(Button("瀏覽", 669, 311, 98, (_, _) =>
        {
            using var dialog = new OpenFileDialog { Filter = "執行程式 (*.exe;*.cmd)|*.exe;*.cmd|所有檔案 (*.*)|*.*" };
            if (dialog.ShowDialog(this) == DialogResult.OK) codex.Text = dialog.FileName;
        }));
        configuration.Controls.Add(Button("儲存設定", 34, 388, 194, (_, _) => SaveSettings(true), true));
        configuration.Controls.Add(Button("重新讀取", 244, 388, 160, (_, _) => LoadSettings()));
        configuration.Controls.Add(Label("設定儲存在 %APPDATA%\\QQAIBOT\\codex-bridge.json，不會傳到 GitHub。", 32, 454, 790));

        permissions.Controls.Add(Label("只開放必要的資料夾給 CodexWork", 32, 36, 770, 14, true));
        permissions.Controls.Add(Label("允許讀取的資料夾（可不填）", 32, 93, 650));
        readRoot = Input(34, 135, 617); permissions.Controls.Add(readRoot);
        permissions.Controls.Add(Button("選擇資料夾", 666, 130, 125, (_, _) =>
        {
            using var picker = new FolderBrowserDialog { Description = "選取 CodexWork 允許讀取的資料夾" };
            if (picker.ShowDialog(this) == DialogResult.OK) readRoot.Text = picker.SelectedPath;
        }));
        editAllowed = new CheckBox { Text = "也允許 Codex 編輯這個資料夾（預設關閉）",
            Left = 34, Top = 208, Width = 600, Height = 36,
            BackColor = Color.Transparent, ForeColor = foreground };
        permissions.Controls.Add(editAllowed);
        permissions.Controls.Add(Label("未啟用時，CodexWork 不具備任意編輯你的本機檔案的權限。", 32, 262, 790));
        permissions.Controls.Add(Button("儲存資料夾權限", 34, 331, 229, (_, _) => SaveSettings(true), true));

        diagnostics.Controls.Add(Label("本機連線診斷（不顯示 Token 或聊天內容）", 32, 27, 760, 13, true));
        log = Input(32, 79, 800);
        log.Multiline = true; log.ScrollBars = ScrollBars.Vertical; log.ReadOnly = true;
        log.WordWrap = true; log.Height = 330; log.BackColor = Color.FromArgb(10, 16, 26);
        log.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top | AnchorStyles.Bottom;
        diagnostics.Controls.Add(log);
        diagnostics.Controls.Add(Button("重新讀取日誌", 32, 438, 189, (_, _) => RefreshLog()));
        diagnostics.Controls.Add(Button("開啟日誌資料夾", 238, 438, 201, (_, _) =>
        {
            Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
            Process.Start(new ProcessStartInfo("explorer.exe", Path.GetDirectoryName(logPath)!) { UseShellExecute = true });
        }));
        diagnostics.Controls.Add(Label("可分享安全的事件碼及時間；不要傳送設定檔或 Token。", 32, 495, 760));
        tabs.Selected += (_, e) => { if (e.TabPage == diagnostics) RefreshLog(); };
    }
    private TabPage NewTab(string name, TabControl parent)
    {
        var tab = new TabPage(name) { BackColor = background, ForeColor = foreground, AutoScroll = true };
        parent.TabPages.Add(tab);
        return tab;
    }
    private void ShowStatus(string status, string explanation, bool connected)
    {
        if (IsDisposed) return;
        if (InvokeRequired) { BeginInvoke(() => ShowStatus(status, explanation, connected)); return; }
        state.Text = status;
        state.ForeColor = connected ? Color.FromArgb(102, 225, 163) : accent;
        detail.Text = explanation;
        start.Enabled = engine is null || engine.HasExited;
        stop.Enabled = engine is not null && !engine.HasExited;
    }
    private void LoadSettings()
    {
        try
        {
            JsonNode? root = File.Exists(configPath) ? JsonNode.Parse(File.ReadAllText(configPath)) : null;
            configInvalid = root is not null && root is not JsonObject;
            if (configInvalid) throw new InvalidDataException("設定檔必須為 JSON Object");
            url.Text = root?["bridgeUrl"]?.GetValue<string>() ?? DefaultUrl;
            token.Text = root?["bridgeToken"]?.GetValue<string>() ?? "";
            codex.Text = root?["codexBin"]?.GetValue<string>() ?? "codex";
            readRoot.Text = root?["readRoots"]?["project"]?.GetValue<string>() ?? "";
            editAllowed.Checked = !string.IsNullOrEmpty(root?["editRoots"]?["project"]?.GetValue<string>());
            Append("已讀取本機設定（憑證值不會顯示在日誌）");
        }
        catch (Exception)
        {
            configInvalid = true;
            ShowMessage("設定檔 JSON 無法解析。為避免覆蓋你已有的設定，我不會自動改寫。請先檢查設定檔。", MessageBoxIcon.Warning);
        }
    }
    private bool SaveSettings(bool showFeedback)
    {
        if (configInvalid) { ShowMessage("設定檔無效，請先修復 JSON 再儲存。", MessageBoxIcon.Warning); return false; }
        if (!Uri.TryCreate(url.Text.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != "wss")
        {
            ShowMessage("Worker 位址必須使用 wss://", MessageBoxIcon.Warning); return false;
        }
        try
        {
            var current = File.Exists(configPath) ? JsonNode.Parse(File.ReadAllText(configPath)) as JsonObject : null;
            current ??= new JsonObject();
            current["bridgeUrl"] = url.Text.Trim();
            current["bridgeToken"] = token.Text.Trim();
            current["codexBin"] = string.IsNullOrWhiteSpace(codex.Text) ? "codex" : codex.Text.Trim();
            var reads = current["readRoots"] as JsonObject ?? new JsonObject();
            var edits = current["editRoots"] as JsonObject ?? new JsonObject();
            if (string.IsNullOrWhiteSpace(readRoot.Text)) { reads.Remove("project"); edits.Remove("project"); }
            else { reads["project"] = readRoot.Text.Trim(); if (editAllowed.Checked) edits["project"] = readRoot.Text.Trim(); else edits.Remove("project"); }
            if (current["readRoots"] is not JsonObject) current["readRoots"] = reads;
            if (current["editRoots"] is not JsonObject) current["editRoots"] = edits;
            Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
            var tmp = configPath + ".pending";
            File.WriteAllText(tmp, current.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            File.Move(tmp, configPath, true);
            Append("設定已安全儲存（不輸出 Token）");
            if (showFeedback) ShowMessage("設定已儲存。若連線正在執行，請停止後重新啟動。", MessageBoxIcon.Information);
            return true;
        }
        catch (Exception ex) { Append("儲存設定失敗："+ex.GetType().Name); ShowMessage("無法儲存設定，請檢查資料夾存取權限。", MessageBoxIcon.Error); return false; }
    }
    private async Task StartEngine()
    {
        if (engine is { HasExited: false }) return;
        if (string.IsNullOrWhiteSpace(token.Text) && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("QQAI_CODEX_BRIDGE_TOKEN")))
        {
            ShowMessage("請先在「連線設定」輸入你已有的 Bridge Token（不要傳給其他人）。", MessageBoxIcon.Information); return;
        }
        if (!SaveSettings(false)) return;
        var path = Path.Combine(AppContext.BaseDirectory, "QQAIBOT-CodexBridge-Engine.exe");
        if (!File.Exists(path)) { ShowMessage("找不到後端引擎 QQAIBOT-CodexBridge-Engine.exe，請將兩個 EXE 放在同一資料夾。", MessageBoxIcon.Error); return; }
        try
        {
            var p = new Process();
            p.StartInfo = new ProcessStartInfo
            {
                FileName = path, Arguments = "--run --config \"" + configPath.Replace("\"", "") + "\"",
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8,
                StandardErrorEncoding = System.Text.Encoding.UTF8,
                WorkingDirectory = AppContext.BaseDirectory
            };
            p.EnableRaisingEvents = true;
            p.OutputDataReceived += (_, e) => { if (e.Data is not null) OnEngineMessage(e.Data); };
            p.ErrorDataReceived += (_, e) => { if (e.Data is not null) OnEngineMessage(e.Data); };
            p.Exited += (_, _) =>
            {
                var code = p.ExitCode;
                if (!shuttingDown) ShowStatus("已停止", "後端程序已結束，退出碼：" + code + "。請查看「診斷日誌」。", false);
            };
            engine = p;
            if (!p.Start()) throw new InvalidOperationException("ENGINE_START_FAILED");
            p.BeginOutputReadLine(); p.BeginErrorReadLine();
            ShowStatus("正在連線…", "等待 Worker WebSocket 握手。", false);
            Append("GUI 已啟動 Codex Bridge 引擎（無主控台視窗）");
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            engine = null; Append("啟動失敗：" + ex.GetType().Name);
            ShowStatus("啟動失敗", "請確定兩個 EXE 都存在，並檢查「診斷日誌」。", false);
        }
    }
    private void OnEngineMessage(string line)
    {
        string safe = line;
        if (!string.IsNullOrWhiteSpace(token.Text)) safe = safe.Replace(token.Text, "[REDACTED]", StringComparison.Ordinal);
        if (safe.Length > 600) safe = safe[..600];
        if (safe.Contains("Worker 已回應握手") || safe.Contains("SERVER_READY")) ShowStatus("已連線", "Worker 握手完成；可使用 GPT-6 Luna non-think（須 Codex CLI 已登入且支援）。", true);
        else if (safe.Contains("WebSocket 已連線")) ShowStatus("WebSocket 已連線", "已連上 Worker，正在等待握手回應。", true);
        else if (safe.Contains("已斷線") || safe.Contains("DISCONNECTED")) ShowStatus("連線中斷", "引擎會自動重試，無需重複啟動。", false);
        else if (safe.Contains("HTTP_401")) ShowStatus("驗證失敗", "HTTP 401：請核對本機 Token 與 Worker Secret 是否一致。", false);
        Append(safe);
    }
    private void StopEngine()
    {
        var p = engine; engine = null;
        if (p is null) return;
        try { if (!p.HasExited) p.Kill(entireProcessTree: true); }
        catch { }
        try { p.Dispose(); } catch { }
        if (!shuttingDown) ShowStatus("已停止", "可按「啟動連線」重新連線。", false);
    }
    private void Append(string message)
    {
        if (IsDisposed || log is null) return;
        if (InvokeRequired) { BeginInvoke(() => Append(message)); return; }
        if (log.TextLength > 28000) log.Text = log.Text[^14000..];
        log.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message + Environment.NewLine);
    }
    private void RefreshLog()
    {
        try
        {
            if (!File.Exists(logPath)) { Append("尚無本機引擎診斷日誌。"); return; }
            string text = File.ReadAllText(logPath);
            if (!string.IsNullOrWhiteSpace(token.Text)) text = text.Replace(token.Text, "[REDACTED]", StringComparison.Ordinal);
            log.Text = text.Length > 22000 ? text[^22000..] : text;
        }
        catch { Append("讀取日誌失敗。"); }
    }
    private void ShowMessage(string message, MessageBoxIcon icon) => MessageBox.Show(this, message, "QQAIBOT Codex Bridge", MessageBoxButtons.OK, icon);
}
