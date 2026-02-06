FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git && \
    git clone https://github.com/zaidka/genieacs-sim.git . && \
    npm install && \
    sed -i 's/setTimeout(30000/setTimeout(120000/' simulator.js
ENTRYPOINT ["node", "genieacs-sim"]
