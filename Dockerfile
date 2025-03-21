FROM node:22-bullseye-slim

RUN apt-get update \
    && apt-get install -y libgtk2.0-0 libnss3 libatk-bridge2.0-0 libdrm-dev libxkbcommon-x11-0 libgbm-dev libasound2

WORKDIR /app

CMD [ "sh" ]