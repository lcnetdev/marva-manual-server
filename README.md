# marva-manual-server

A simple server that can clone a documentation repo full of markdown files and convert them into HTML.

Build specifically for gitlab webhook triggering.

### Config
Set these env variables in the docker-compose file:
```
      GIT_REPO: "This is the http URL to the repo .git file. Use the format https://username:token@gitlab.... to pass username and token auth" 
      GIT_REPO_NAME: "the name of the repo folder"
      BUILD_ACCESS_TOKEN: "the token that is expected to be sent in the webhook from the gitlab"
      URL_PATH_PREFIX: "What is the real path the will end up at the router, you can add prefix here if needed."
```

### Process
The script will convert readme.md pages into index.html files all other .md files become .html with orginal names. jpg, gif, png files are copied over all other files are ignored.

Modifiy the HTML in the templates/ directory to add customized headers or footers or CSS etc.

### Invoke

It is designed to be invoked by gitlab webhook, but you could invoke it manually:
```
curl -i -H "X-Gitlab-Token: YOUR_TOKEN_HERE" -X POST http://path.to.where/its/running
```
