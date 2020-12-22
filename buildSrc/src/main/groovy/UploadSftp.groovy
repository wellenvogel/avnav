import com.jcraft.jsch.ChannelSftp
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import com.jcraft.jsch.SftpProgressMonitor
import org.gradle.api.DefaultTask
import org.gradle.api.file.FileTree
import org.gradle.api.file.FileVisitDetails
import org.gradle.api.tasks.TaskAction

import java.security.MessageDigest

class UploadSftp extends DefaultTask{

    protected createdDirs=[]


    protected Hashes=[:]

    static def md5( obj ) {
        def hash = MessageDigest.getInstance( 'MD5' ).with {
            obj.eachByte( 8192 ) { bfr, num ->
                update bfr, 0, num
            }
            it.digest()
        }
        return new BigInteger( 1, hash ).toString( 16 ).padLeft( 32, '0' )

    }
    static def computeHashes(fileTree){
        def rt=[:]
        fileTree.visit { FileVisitDetails element ->
            if (element.isDirectory()) return
            def name=element.getPath()
            def hash=md5(element.open())
            rt.put(name,hash)
        }
        return rt
    }

    private void removeRemoteDir(ChannelSftp channel, String dirToList) {
        logger.info("delete remote dir $dirToList")
        Vector<ChannelSftp.LsEntry> subFiles=channel.ls(dirToList);
        if (subFiles != null && subFiles.size() > 0) {
            for (ChannelSftp.LsEntry aFile : subFiles) {
                String currentFileName = aFile.getFilename();
                if (currentFileName.equals(".") || currentFileName.equals("..")) {
                    // skip parent directory and the directory itself
                    continue;
                }
                String filePath = dirToList + "/"+currentFileName
                if (aFile.getAttrs().isDir()) {
                    // remove the sub directory
                    removeRemoteDir(channel, filePath);
                } else {
                    // delete the file
                    channel.rm(filePath);
                }
            }

            // finally, remove the directory itself
            channel.rmdir(dirToList);
        }
    }
    /**
     * create a remote dir and change to it
     * @param client
     * @param path
     */
    private void createRemoteDirAndCd(ChannelSftp client, String path) throws Exception{
        path=path.replaceAll("^//*","/")
        if (createdDirs.contains(path)) {
            client.cd(path)
            return
        }
        logger.info("create remote dir $path")
        boolean abs=false
        if (path.startsWith("/")){
            abs=true
            path=path.substring(1)
        }
        def dirs=path.split(/\//)
        if (abs){
            logger.debug("trying absolute base")
            client.cd("/")
            String wd=client.pwd()
            logger.debug("current working dir=$wd")
            if (wd != "/") assert res,"unable to change to ftp root dir"
        }
        else{
            logger.info("current working dir=${client.pwd()}")
        }
        def curPath=client.pwd()
        dirs.each{ String dir->
            Vector<ChannelSftp.LsEntry> subFiles=client.ls(curPath)
            boolean res=false
            if (subFiles != null && subFiles.find{s-> return s.getFilename() == dir}){
                logger.info("directory $curPath/$dir already exists")
                client.cd(dir)
            }
            else{
                logger.info("creating dir $dir in $curPath ")
                client.mkdir(dir)
                client.cd(dir)
            }
            curPath=client.pwd()
            createdDirs.add(curPath)

        }
    }

    protected void uploadFile(ChannelSftp ftp,String dir,File ifile) throws Exception{
        logger.lifecycle("uploading $ifile to $dir")
        createRemoteDirAndCd(ftp,dir)
        FileInputStream is=new FileInputStream(ifile)
        def targetName=ifile.getName()
        if (getTargetName != null){
            targetName=getTargetName(ifile)
        }
        try {
            ftp.put(is,targetName)
        }catch (Exception e){
            logger.error("Exception while uploading: ",e)
            e.printStackTrace()
            throw e
        }
        logger.lifecycle("upload of $ifile complete")
    }

    protected void writeRemoteHashes(ChannelSftp ftp,String baseDir,HashMap hashes){
        createRemoteDirAndCd(ftp,baseDir)
        def os=ftp.put(hashFileName)
        os.withPrintWriter { wr ->
            hashes.each { name, md5 ->
                logger.debug("writing remote hash entry name=${name}, hash=${md5}")
                wr.println("${md5} ${name}")
            }
        }
        os.close()
    }

    protected Map readRemoteHashes(ChannelSftp ftp, String baseDir){
        def rt=[:]
        ftp.cd(baseDir)
        logger.info("trying to read remote hash file ${baseDir}/${hashFileName}")
        def is
        try {
            is = ftp.get(hashFileName)
        }catch (Exception e){
            logger.info("unable to read remote hashes: $e");
        }
        if (is == null) {
            logger.info("unable to get remote hashes")
            return null
        }
        is.withReader{ rd->
            rd.readLines().each{ line->
                def nv=line.split(" ",2)
                if (nv.size() < 2){
                    logger.info("invalid line in remote hash: ${line}, ignoring")
                    return
                }
                logger.debug("reading remote hash, name=${nv[1]}, md5=${nv[0]}")
                rt.put(nv[1],nv[0])
            }
        }
        is.close();
        return rt
    }
    def server="www.wellenvogel.net"
    def base="/www/software/avnav/downloads"
    def user
    def passwd
    def privateKey
    def baseDir="daily"
    def useHashes=false
    def hashFileName="_hashes"

    File inputFile
    def getTargetName=null
    FileTree inputFiles
    boolean deleteTargetDir=false

    def getRealBase(){
        def envBase=System.getenv("AVNAV_REPO_BASE");
        if (envBase != null) base=envBase
        return (base+"/"+baseDir).replaceAll('[^/]*/+\\.\\./*','').replaceAll('/*$','')
    }

    @TaskAction
    public void exec() throws Exception{
        /*
        project.exec {
            commandLine "ping","$server"
        }
        */
        assert (inputFile!=null || inputFiles!=null),"missing task parameter inputFile(s)"
        logger.info("uploading to $server")
        def jsch=new JSch();
        if (privateKey == null) {
            privateKey = System.getenv("AVNAV_REPO_KEY")
            if (privateKey == null){
                if (project.hasProperty('privateKey')){
                    logger.lifecycle("using private key file ${project.privateKey}")
                    File f=project.file(project.privateKey)
                    privateKey=f.getText()
                }
            }
            if (privateKey) {
                jsch.addIdentity("test",privateKey.getBytes(),null,null);
            }
        }
        if (user == null) {
            user = System.getenv("AVNAV_REPO_USER")
        }
        assert user!=null,"missing environment variable AVNAV_REPO_USER"
        if (passwd == null) {
            passwd = System.getenv("AVNAV_REPO_PASSWD")
        }
        Session session=jsch.getSession(user, server)
        if (passwd) {
            session.setPassword(passwd)
        }
        if (privateKey) {
            session.setConfig("PreferredAuthentications", "publickey");
        }
        session.setConfig("StrictHostKeyChecking", "no");
        session.connect()
        logger.info("connected to $server")
        ChannelSftp channel=(ChannelSftp)session.openChannel("sftp");
        channel.connect();

        def dir=getRealBase()
        logger.info("realBase=$dir")
        def remoteDir=dir
        if (inputFile != null){
            assert inputFile.exists(),"input file $inputFile does not exist"
            if (deleteTargetDir) removeRemoteDir(ftp,remoteDir)
            uploadFile(channel,remoteDir,inputFile)
        }
        else{
            def skipList=[:]
            def removeList=[:]
            def hasChanges=false
            if (deleteTargetDir) removeRemoteDir(channel,dir)
            if (useHashes && ! deleteTargetDir){
                logger.info("computing local hashes")
                Hashes=computeHashes(inputFiles)
                def remoteHashes=readRemoteHashes(channel,remoteDir)
                if (remoteHashes == null){
                    hasChanges=true
                    logger.lifecycle("no remote hashes file found, deleting remote dir")
                    removeRemoteDir(channel,remoteDir)
                }
                else{
                    Hashes.each{ name,md5 ->
                        def remote=remoteHashes.get(name)
                        if (remote != null){
                            if (remote == md5){
                                logger.info("skipping file ${name} due to equal hash")
                                skipList.put(name,true)
                            }
                            else{
                                logger.info("changed hash for ${name}")
                                hasChanges=true
                            }
                        }
                        else{
                            hasChanges=true
                        }
                    }
                    remoteHashes.each { name,md5 ->
                        if (Hashes.get(name) != null) return;
                        logger.info("marking remote file ${name} for deletion")
                        removeList.put(name,true)
                        hasChanges=true
                    }
                    if (hasChanges) channel.rm(remoteDir+"/"+hashFileName)
                }
            }
            inputFiles.visit { FileVisitDetails element->
                if (!element.isDirectory()) {
                    if (skipList.get(element.getPath())){
                        logger.debug("skipping upload for ${element.getPath()}")
                        return
                    }
                    String dirname = (remoteDir + "/" + element.relativePath.getPathString()).replaceAll('/[^/]*$', '')
                    uploadFile(channel, dirname, element.getFile())
                }
            }
            removeList.each{ name,flag ->
                String fileName=dir+"/"+name
                logger.info("removing remote file ${fileName}")
                channel.rm(fileName)
            }
            if (useHashes && hasChanges){
                logger.info("writing remote hashes")
                writeRemoteHashes(channel,dir,Hashes)
            }


        }
        session.disconnect()
    }
}