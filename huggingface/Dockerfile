FROM mlikiowa/napcat-docker:latest
USER root
ENV NAPCAT_CONFIG_PATH=/data
ENV NAPCAT_WEBUI_PORT=7860
CMD ["sh", "-c", "export NAPCAT_WEBUI_TOKEN=${MY_WEB_TOKEN} && exec /entrypoint.sh"]
EXPOSE 7860

#該程式目前不完善
