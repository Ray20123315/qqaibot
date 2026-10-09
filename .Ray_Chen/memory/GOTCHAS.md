# GOTCHAS

- Three-group latency is cumulative under serial ACK. Even 1 sec fixed alarm + three RTTs can be >5s. Run parallel groups with cap 4 and preserve group FIFO and ACK.
- Native message batching may combine images+text+face; QQ OneBot adapters may reject some mixed voice/video/file segments. Actual acceptance must be tested, not assumed.
- In-flight DO flush needs a needsFlush signal so that new alarms while processing do not lose batches; cron should only wake hub.
- Cloudflare Worker deploy DOES NOT necessarily replace code inside long-lived WebSocket Durable Object; observed GET /internal/flush HTTP 404 on version ac768bc3 after newer Worker deploy. New ID parallel-v3 needs manual NapCat toggle off/on.
- /health connected=false can coexist with recent previous OneBotHub message activity; inspect last event, current readyState and last closed, do not infer current active socket.
- Keep webSocket Token private, do not rotate without operator action. NapCat URL unchanged.
- Abot remains disabled. QQ group protected IDs 3569028262/2681167798 retained.
