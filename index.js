const fastify = require('fastify')({logger: true})
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const path = require('node:path')
const fs = require('fs').promises
const fsAsync = require('fs')

const showdown  = require('showdown');
const converter = new showdown.Converter();

let GIT_REPO_NAME = null
let GIT_REPO = null
let BUILD_ACCESS_TOKEN = null
let URL_PATH_PREFIX = ""

if (process.env.GIT_REPO_NAME){
    GIT_REPO_NAME = process.env.GIT_REPO_NAME
}
if (process.env.GIT_REPO){
    GIT_REPO = process.env.GIT_REPO
}
if (process.env.BUILD_ACCESS_TOKEN){
    BUILD_ACCESS_TOKEN = process.env.BUILD_ACCESS_TOKEN
}
if (process.env.URL_PATH_PREFIX){
    URL_PATH_PREFIX = process.env.URL_PATH_PREFIX
}

let currentlyBuilding = false
let currentlyBuildingQueue = []


let header_html = fsAsync.readFileSync('templates/header.html',{ encoding: 'utf8' });
let footer_html = fsAsync.readFileSync('templates/footer.html',{ encoding: 'utf8' });


fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'app/manual'),
  prefix: `${URL_PATH_PREFIX}/`, // optional: default '/'
//   constraints: { host: 'example.com' } // optional: default {}
})

fastify.post(`${URL_PATH_PREFIX}/build`, function (req, reply) {

    if (BUILD_ACCESS_TOKEN){
        console.log(req.headers)
        if (!req.headers['x-gitlab-token']){
            reply
            .code(401)
            .header('Content-Type', 'application/json; charset=utf-8')
            .send({ message: "You did not supply the header needed to trigger the build process."  })       
            return false
        }

        if (req.headers['x-gitlab-token'] && req.headers['x-gitlab-token'] != BUILD_ACCESS_TOKEN){
            reply
            .code(403)
            .header('Content-Type', 'application/json; charset=utf-8')
            .send({ message: "Invalid build token."  })       
            return false
        }

    }

    currentlyBuildingQueue.push(Math.floor(Date.now() / 1000))

    reply
    .code(200)
    .header('Content-Type', 'application/json; charset=utf-8')
    .send({ buildQueue: currentlyBuildingQueue  })

})


// Run the server!
fastify.listen({ port: 6565, host: '0.0.0.0'  }, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
})



let convertDir = async function(path){

    const dir = await fs.opendir(path)
    let base_path = path.replace(`data/${GIT_REPO_NAME}`,'data/output')

    // does this dir exist yet?
    if (!fsAsync.existsSync(base_path)){
        fs.mkdir(base_path, { recursive: true });
    }

    for await (const dirent of dir) {

        let thisFilePath = `${dirent.path}/${dirent.name}`
        const stat = await fs.lstat(thisFilePath);        
        if (stat.isDirectory()){
            await convertDir(thisFilePath)
        }else if (dirent.name.toLowerCase().endsWith(".md")){

            let markdownText = fsAsync.readFileSync(thisFilePath,{ encoding: 'utf8' });
            let generatedHtml  = converter.makeHtml(markdownText);
            let useName = dirent.name.replace(".md",'.html').replace(".MD",'.html')
            if (dirent.name.toLocaleLowerCase() == 'readme.md'){
                useName = 'index.html'
            }
            fsAsync.writeFileSync(base_path + '/' + useName, `${header_html}\n\n${generatedHtml}\n\n${footer_html}`);
        }else if (dirent.name.toLowerCase().endsWith(".png") || dirent.name.toLowerCase().endsWith(".jpg")){
            fs.copyFile(thisFilePath,base_path + '/' + dirent.name )
        }
    } 
}


let convertDocs = async function(){

    if (!GIT_REPO_NAME){
        console.error("No GIT_REPO_NAME set!")
        return false
    }
    if (fsAsync.existsSync('data/output')){
        fsAsync.rmSync(`data/output`, { recursive: true, force: true });
    }
    await convertDir(`data/${GIT_REPO_NAME}`)
    if (fsAsync.existsSync('app/manual')){
        fsAsync.rmSync(`app/manual`, { recursive: true, force: true });
    }
    fsAsync.renameSync('data/output',  'app/manual')
}

let cloneRepo = async function(){
    if (GIT_REPO){
        if (fsAsync.existsSync(`data/${GIT_REPO_NAME}`)){
            fsAsync.rmSync(`data/${GIT_REPO_NAME}`, { recursive: true, force: true });
        }
        const { stdout, stderr } = await exec(`cd data && git clone ${GIT_REPO}`);
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);    
    }else{
        console.error("GIT_REPO not set")
    }
}



// check ever X seconds to see if we have to build the page
setInterval(async ()=>{

    if (currentlyBuildingQueue.length>0){
        // don't run if already running
        if (currentlyBuilding){
            return false
        }
        currentlyBuilding = true
        console.log("Cloning...")
        await cloneRepo()
        console.log("Building...")
        await convertDocs()
        console.log("Done.")
        // remove a queue'd run
        currentlyBuildingQueue.pop()
        currentlyBuilding = false
    }

    // console.log(currentlyBuildingQueue)    

},5000)


