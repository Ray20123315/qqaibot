FROM mlikiowa/napcat-docker:latest
USER root

ENV NAPCAT_CONFIG_PATH=/data
ENV NAPCAT_WEBUI_PORT=7860
ENV MY_WEB_TOKEN=change-me

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${NAPCAT_WEBUI_PORT}/" >/dev/null 2>&1 || exit 1

# This image only runs NapCat, which connects QQ to the Cloudflare Worker webhook.
# Deploy the Worker separately with `npx wrangler deploy`.
CMD ["sh", "-c", "export NAPCAT_WEBUI_TOKEN=\"${MY_WEB_TOKEN}\" && exec /entrypoint.sh"]
