import org.apache.commons.net.ftp.FTP
import org.apache.commons.net.ftp.FTPClient
import org.apache.commons.net.ftp.FTPFile
import org.apache.commons.net.ftp.FTPReply
import org.gradle.api.DefaultTask
import org.gradle.api.file.FileTree
import org.gradle.api.file.FileVisitDetails
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.*

import java.security.MessageDigest

class UploadTask extends DefaultTask{

    protected createdDirs=[]
    private void checkReply(FTPClient ftp){
        if (! FTPReply.isPositiveCompletion(ftp.getReplyCode())){
            throw new Exception("negative ftp reply: "+ftp.getReplyString())
        }
    }

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

    private void removeRemoteDir(FTPClient ftpClient, String dirToList) {
        logger.info("delete remote dir $dirToList")
        FTPFile[] subFiles = ftpClient.listFiles(dirToList);
        if (subFiles != null && subFiles.length > 0) {
            for (FTPFile aFile : subFiles) {
                String currentFileName = aFile.getName();
                if (currentFileName.equals(".") || currentFileName.equals("..")) {
                    // skip parent directory and the directory itself
                    continue;
                }
                String filePath = dirToList + "/"+currentFileName
                if (aFile.isDirectory()) {
                    // remove the sub directory
                    removeRemoteDir(ftpClient, filePath);
                } else {
                    // delete the file
                    boolean deleted = ftpClient.deleteFile(filePath);
                }
            }

            // finally, remove the directory itself
            boolean removed = ftpClient.removeDirectory(dirToList);
        }
    }
    /**
     * create a remote dir and change to it
     * @param client
     * @param path
     */
    private void createRemoteDir(FTPClient client,String path){
        if (createdDirs.contains(path)) {
            client.changeWorkingDirectory(path)
            String wd=client.printWorkingDirectory()
            logger.info("current working dir=$wd")
            return
        }
        boolean abs=false
        if (path.startsWith("/")){
            abs=true
            path=path.substring(1)
        }
        def dirs=path.split(/\//)
        def curpath=""
        if (abs){
            boolean res=client.changeWorkingDirectory("/")
            if (! res){
                String wd=client.printWorkingDirectory()
                logger.info("current working dir=$wd")
                if (wd == "/") res=true
            }
            assert res,"unable to change to ftp root dir"
            curpath="/"
        }
        dirs.each{ String dir->
            curpath=client.printWorkingDirectory()
            org.apache.commons.net.ftp.FTPFile [] subFiles=client.listDirectories()
            boolean res=false
            if (subFiles != null && subFiles.contains(dir)){
                logger.info("directory $curpath/$dir already exists")
                res=client.changeWorkingDirectory(dir)
            }
            else{
                client.makeDirectory(dir)
                res=client.changeWorkingDirectory(dir)
            }
            assert res,"unable to change to ftp directory $curpath"
            createdDirs.add(curpath)
        }
    }

    protected void uploadFile(FTPClient ftp,String dir,File ifile){
        createRemoteDir(ftp,dir)
        ftp.setFileType(FTP.BINARY_FILE_TYPE)
        FileInputStream is=new FileInputStream(ifile)
        logger.lifecycle("uploading $ifile to $dir")
        def targetName=ifile.getName()
        if (getTargetName != null){
            targetName=getTargetName(ifile)
        }
        try {
            ftp.storeFile(targetName, is)
        }catch (Exception e){
            logger.error("Exception while uploading: ",e)
            e.printStackTrace()
            throw e
        }
        logger.lifecycle("upload of $ifile complete")
    }

    protected void writeRemoteHashes(FTPClient ftp,String baseDir,HashMap hashes){
        createRemoteDir(ftp,baseDir)
        ftp.setFileType(FTP.BINARY_FILE_TYPE)
        def os=ftp.storeFileStream(hashFileName)
        os.withPrintWriter { wr ->
            hashes.each { name, md5 ->
                logger.debug("writing remote hash entry name=${name}, hash=${md5}")
                wr.println("${md5} ${name}")
            }
        }
        ftp.completePendingCommand()
    }

    protected Map readRemoteHashes(FTPClient ftp, String baseDir){
        def rt=[:]
        ftp.setFileType(FTP.BINARY_FILE_TYPE)
        def cs=ftp.changeWorkingDirectory(baseDir)
        if ( !cs){
            logger.info("base dir ${baseDir} not found in remote, unable to read hashes")
            return null
        }
        logger.info("trying to read remote hash file ${baseDir}/${hashFileName}")
        def is=ftp.retrieveFileStream(hashFileName)
        if (is == null) {
            logger.info("ftp reply code was ${ftp.getReplyCode()}")
            return null
        }
        is.withReader{ rd->
            rd.readLines().each{ line->
                def nv=line.split(" ",2)
                if (nv.size() < 2){
                    logger.info("invalid line in remote hash: ${line}, ignoring")
                    return
                }
                logger.debug("reading remotze hash, name=${nv[1]}, md5=${nv[0]}")
                rt.put(nv[1],nv[0])
            }
        }
        ftp.completePendingCommand();
        return rt
    }
    @Internal
    def server="www.wellenvogel.net"
    @Internal
    def base="/www/software/avnav/downloads"
    @Internal
    def baseDir="daily"
    @Internal
    def user
    @Internal
    def passwd
    @Internal
    def useHashes=false
    @Internal
    def hashFileName="_hashes"

    @Internal
    File inputFile
    @Internal
    def getTargetName=null
    @Internal
    FileTree inputFiles
    @Internal
    boolean deleteTargetDir=false

    @Internal
    def getRealBase(){
        def envBase=System.getenv("AVNAV_REPO_BASE");
        if (envBase != null) base=envBase
        return (base+"/"+baseDir).replaceAll('[^/]*/+\\.\\./*','').replaceAll('/*$','')
    }

    @TaskAction
    public void exec(){
        assert (inputFile!=null || inputFiles!=null),"missing task parameter inputFile(s)"
        logger.info("uploading to $server")
        def ftp=new FTPClient();
        if (user == null) {
            user = System.getenv("AVNAV_REPO_USER")
        }
        assert user!=null,"missing environment variable AVNAV_REPO_USER"
        if (passwd == null) {
            passwd = System.getenv("AVNAV_REPO_PASSWD")
        }
        assert passwd !=null,"missing environemt variable AVNAV_REPO_PASSWD"
        ftp.connect(server)
        checkReply(ftp)
        ftp.login(user,passwd)
        checkReply(ftp)
        ftp.enterLocalPassiveMode()
        ftp.setBufferSize(1024*1024)
        def dir=getRealBase()
        logger.info("realBase=$dir")
        def remoteDir=dir
        if (inputFile != null){
            assert inputFile.exists(),"input file $inputFile does not exist"
            if (deleteTargetDir) removeRemoteDir(ftp,remoteDir)
            uploadFile(ftp,remoteDir,inputFile)
        }
        else{
            def skipList=[:]
            def removeList=[:]
            def hasChanges=false
            if (deleteTargetDir) removeRemoteDir(ftp,dir)
            if (useHashes && ! deleteTargetDir){
                logger.info("computing local hashes")
                Hashes=computeHashes(inputFiles)
                def remoteHashes=readRemoteHashes(ftp,remoteDir)
                if (remoteHashes == null){
                    hasChanges=true
                    logger.lifecycle("no remote hashes file found, deleting remote dir")
                    removeRemoteDir(ftp,remoteDir)
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
                    if (hasChanges) ftp.deleteFile(remoteDir+"/"+hashFileName)
                }
            }
            inputFiles.visit { FileVisitDetails element->
                if (!element.isDirectory()) {
                    if (skipList.get(element.getPath())){
                        logger.debug("skipping upload for ${element.getPath()}")
                        return
                    }
                    String dirname = (remoteDir + "/" + element.relativePath.getPathString()).replaceAll('/[^/]*$', '')
                    uploadFile(ftp, dirname, element.getFile())
                }
            }
            removeList.each{ name,flag ->
                String fileName=dir+"/"+name
                logger.info("removing remote file ${fileName}")
                ftp.deleteFile(fileName)
            }
            if (useHashes && hasChanges){
                logger.info("writing remote hashes")
                writeRemoteHashes(ftp,dir,Hashes)
            }


        }
        //checkReply(ftp)
        ftp.disconnect()
    }
}