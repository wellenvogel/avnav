import org.gradle.api.DefaultTask
import org.gradle.api.tasks.TaskAction

class UploadHtAccess extends UploadTask{

    def sourceName=null
    def version=null

    static def createHtAccess(src,dest,version){
        File ddir=dest.getParentFile()
        if (! ddir.exists()) ddir.mkdirs()
        if (! src.exists()) throw new Exception("$src not found")
        src.withReader{ rd->
            dest.withWriter{ wr->
                rd.readLines().each { String line ->
                    line=line.replace("VERSION",version)
                    wr.println(line)
                }
            }
        }
    }
    @TaskAction
    public void exec(){
        assert sourceName != null
        def src=project.file(sourceName)
        assert src.exists()
        assert baseDir != null
        assert version != null
        inputFile=new File(project.buildDir,src.getName())
        createHtAccess(src,inputFile,version)
        getTargetName={ return ".htaccess"}
        super.exec()

    }

}
