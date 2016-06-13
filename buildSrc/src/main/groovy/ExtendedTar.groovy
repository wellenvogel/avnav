import org.gradle.api.file.FileCopyDetails
import org.gradle.api.internal.file.copy.CopyAction
import org.gradle.api.internal.file.copy.CopyActionProcessingStream
import org.gradle.api.tasks.AbstractCopyTask
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.WorkResult
import org.apache.commons.compress.archivers.tar.*;

class WR implements WorkResult{
    private rt=true
    public WR(boolean r){
        rt=r
    }
    boolean getDidWork() {
        return rt
    }
}
class ExtendedTar extends AbstractCopyTask {
    def ofile
    protected Closure modifyEntry
    /**
     * set a handler that will be called before each entry is copied into the archive
     * you can provide a closure that will be called with the TarArchiveEntry and the FileCopyDetails
     * you must return a boolean indicating whether the entry should be added or not
     * @param c
     */
    protected void modifyEntry(Closure c){
        modifyEntry=c
    }
    protected TarArchiveOutputStream tar
    protected CopyAction createCopyAction() {
        return {
            CopyActionProcessingStream stream ->
                stream.process { FileCopyDetails details ->
                    if (tar == null){
                        tar= new TarArchiveOutputStream(new FileOutputStream(project.file(ofile)))
                    }
                    //println "processing "+details.relativePath.pathString
                    boolean hasSource=false
                    try{
                        details.getFile()
                        hasSource=true
                    }catch (Exception e){}
                    TarArchiveEntry entry;
                    boolean addEntry
                    if (hasSource) {
                        entry = new TarArchiveEntry(details.getFile(), details.relativePath.pathString)
                        if (modifyEntry != null){
                            addEntry=modifyEntry.call(entry,details)
                        }
                    }
                    else{
                        //if the details have no source file it must be a directory
                        //this typically comes from an "into" in the copySpec
                        entry= new TarArchiveEntry(details.relativePath.pathString+"/")
                        entry.setMode(0755);
                    }
                    if (addEntry) {
                        logger.debug("$name: adding "+entry.getName())
                        tar.putArchiveEntry(entry)
                        if (hasSource && !details.getFile().isDirectory()) {
                            tar.write(details.open().getBytes())
                        }
                        tar.closeArchiveEntry()
                    }

                }
                new WR(true)
        }
    }
    @TaskAction
    void exec(){
        super.copy()
        if (tar != null){
            logger.debug("$name: closing archive "+ofile+" with "+tar.bytesWritten+" bytes written")
            tar.close()
            tar=null
        }
    }
}