package de.wellenvogel.avnav.selendroid.test1;

import io.selendroid.client.SelendroidDriver;
import io.selendroid.common.SelendroidCapabilities;
import io.selendroid.standalone.SelendroidConfiguration;
import io.selendroid.standalone.SelendroidLauncher;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.openqa.selenium.By;
import org.openqa.selenium.ElementNotVisibleException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.io.File;
import java.util.ArrayList;

/**
 * Created by andreas on 06.12.15.
 */
public class TestBase {
    public static final String APP="de.wellenvogel.avnav.main";
    public static final String SETTINGSFILE="/data/data/"+APP+"/shared_prefs/AvNav.xml";
    public static final String ANDROID_BUILD_DIR="../android"
    public static final String MANIFEST=ANDROID_BUILD_DIR+"/AndroidManifest.xml"
    public static final String DEFAULTAPK=ANDROID_BUILD_DIR+"/build/outputs/apk/android-debug.apk";
    public static final String RESOURCES="src/test/resources"
    public static final String RESOURCES_TMP="build/test-resources"
    public static final String ANDROID_NAMESPACE="http://schemas.android.com/apk/res/android"

    private static SelendroidLauncher selendroidServer = null;
    protected WebDriver driver = null;

    public String getVersion(){
        def parser = new XmlSlurper()
        parser.setFeature("http://xml.org/sax/features/external-general-entities", false)
        parser.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        File manifest=new File(MANIFEST)
        assert manifest.exists()
        def doc=parser.parse(manifest).declareNamespace(android:ANDROID_NAMESPACE)
        def version=doc.'@android:versionName'.text()
        println "##Version from Manifest="+version
        return version
    }
    public String getVersionCode(){
        def parser = new XmlSlurper()
        parser.setFeature("http://xml.org/sax/features/external-general-entities", false)
        parser.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        File manifest=new File(MANIFEST)
        assert manifest.exists()
        def doc=parser.parse(manifest).declareNamespace(android:ANDROID_NAMESPACE)
        def version=doc.'@android:versionCode'.text()
        println "##VersionCode from Manifest="+version
        return version
    }

    public File updateSettings(String settingsName,Map<String,String> replacements){
        File infile=new File(RESOURCES+"/"+settingsName);
        assert infile.exists()
        File outfile=new File(RESOURCES_TMP+"/"+settingsName)
        if (outfile.exists()) outfile.delete()
        else {
            outfile.getParentFile().mkdirs()
            assert outfile.getParentFile().isDirectory()
        }
        def xml = infile.text
        def document = groovy.xml.DOMBuilder.parse(new StringReader(xml))
        def root = document.documentElement
        if (replacements == null){
            replacements=[version: getVersionCode()]
        }
        if (replacements != null) {
            use(groovy.xml.dom.DOMCategory) {
                root.string?.each {
                    def n=it.xpath("@name")
                    def v=replacements.get(n)
                    if (v != null) {
                        it.setValue(v)
                        println "XML:" + n + "=" + it.text();
                    }
                }
                root.int?.each {
                    def n=it.xpath("@name")
                    def v=replacements.get(n)
                    if (v != null) {
                        it.setAttribute("value",v)
                        println "XML:" + n + "=" + v;
                    }
                }
                root.boolean?.each {
                    def n=it.xpath("@name")
                    def v=replacements.get(n)
                    if (v != null) {
                        it.setAttribute("value",v)
                        println "XML:" + n + "=" + v;
                    }
                }

            }
        }

        def result = groovy.xml.XmlUtil.serialize(root)

        outfile.withWriter { w ->
            w.write(result)
        }
        println "##created tmp settings at "+outfile
        return outfile
    }

    @BeforeClass
    public static void startServer(){
        if (selendroidServer != null) {
            return;
        }
        SelendroidConfiguration config = new SelendroidConfiguration();
        String apkName=System.getProperty("avnavtest.apkName");
        if (apkName == null) apkName=DEFAULTAPK;
        config.addSupportedApp(new File(apkName).getAbsolutePath());
        config.setNoClearData(true);
        selendroidServer = new SelendroidLauncher(config);
        selendroidServer.launchSelendroid();
    }

    @AfterClass
    public static void stopServer(){
        if (selendroidServer == null) return;
        selendroidServer.stopSelendroid();

    }

    protected WebElement waitForElement(String id, int timeout) throws InterruptedException,ElementNotVisibleException {
        WebElement rt=null;
        while (timeout > 0) {
            try {
                rt=driver.findElement(By.id(id));
                return rt;
            }catch (Exception ex){
            }
            Thread.sleep(100);
            timeout-=100;
        }
        throw new ElementNotVisibleException("element with id="+id+" not visible after timeout");
    }

    protected WebElement waitForVisibleElement(String id, int timeout) throws Exception {
        int waitTime1=timeout/2
        WebElement el=waitForElement(id,waitTime1);
        timeout=timeout/2;
        while (timeout > 0){
            if (el.isDisplayed()) return el;
            Thread.sleep(100);
            timeout-=100;
        }
        throw new Exception("elemnt with id="+id+" not visible after timeout");
    }
    public void startSelendroidServer(boolean clearData) throws Exception {
        startSelendroidServer(clearData,null,null);
    }
    public void startSelendroidServer(boolean clearData,String settings,Map<String,String> replacements) throws Exception {
        SelendroidCapabilities caps = new SelendroidCapabilities(APP+":"+getVersion());
        caps.setEmulator(true);
        ArrayList<String> commands=new ArrayList<String>();
        if (clearData){
            commands.add("shell pm clear "+APP);
        }
        if (settings != null){
            File tmpSettings=updateSettings(settings,replacements)
            commands.add("push "+tmpSettings.getAbsolutePath()+" "+SETTINGSFILE);
        }
        if (commands.size() > 0) {
            caps.setPreSessionAdbCommands(commands);
        }
        driver = new SelendroidDriver(caps);
        System.out.println("##driver started");
    }

    @After
    public void stopSelendroidServer() {
        if (driver != null) {
            driver.quit();
        }

    }
}
