import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

abstract class MarkdownToHtmlTask extends DefaultTask {

    @InputFile
    @PathSensitive(PathSensitivity.NONE)
    abstract RegularFileProperty getInputFile()

    @OutputFile
    abstract RegularFileProperty getOutputFile()

    @TaskAction
    void convert() {
        def parser = Parser.builder().build()
        def renderer = HtmlRenderer.builder().build()

        def mdFile = inputFile.get().asFile
        def htmlFile = outputFile.get().asFile
        htmlFile.parentFile.mkdirs()

        def document = parser.parse(mdFile.getText('UTF-8'))
        htmlFile.setText(renderer.render(document), 'UTF-8')
    }
}
