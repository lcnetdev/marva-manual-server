FROM node:lts-alpine3.19

RUN apk update && apk upgrade --no-cache
RUN apk add --no-cache git
RUN apk add --no-cache wget



RUN npm install forever -g
RUN npm install nodemon -g

CMD ["bash"]