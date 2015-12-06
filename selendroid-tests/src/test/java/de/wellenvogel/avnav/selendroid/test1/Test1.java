package de.wellenvogel.avnav.selendroid.test1;

/**
 * Created by andreas on 06.12.15.
 */
/*
 * Copyright 2012-2014 eBay Software Foundation and selendroid committers.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

import io.selendroid.client.SelendroidDriver;
import io.selendroid.common.SelendroidCapabilities;
import io.selendroid.standalone.SelendroidConfiguration;
import io.selendroid.standalone.SelendroidLauncher;

import org.junit.After;
import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;
import org.openqa.selenium.By;
import org.openqa.selenium.ElementNotVisibleException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.util.ArrayList;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class Test1 {
    private SelendroidLauncher selendroidServer = null;
    private WebDriver driver = null;
    private int startcount=0;


    private WebElement waitForElement(String id,int timeout) throws InterruptedException,ElementNotVisibleException {
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

    private WebElement waitForVisibleElement(String id, int timeout) throws Exception {
        WebElement el=waitForElement(id,timeout/2);
        timeout=timeout/2;
        while (timeout > 0){
            if (el.isDisplayed()) return el;
            Thread.sleep(100);
            timeout-=100;
        }
        throw new Exception("elemnt with id="+id+" not visible after timeout");
    }
    @Test
    public void a1startApp() throws Exception {
        startSelendroidServer(true);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        startcount++;
        System.out.println("##driver get OK");
        WebElement initialTitle=driver.findElement(By.xpath("//DialogTitle[@id='alertTitle']"));
        assert initialTitle.getText().equals("Initial Settings");
        WebElement element = driver.findElement(By.id("button1")); //setings button in init dialog
        element.click();
        Thread.sleep(2000);
        element=driver.findElement(By.id("headers"));
        element=driver.findElement(By.id("action_ok"));
        element.click();
        Thread.sleep(3000);
        element=driver.findElement(By.id("webmain"));
        System.out.println("successfully started into main app");
    }

    @Test
    public void a2startApp2() throws Exception {
        startSelendroidServer(false);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        System.out.println("##driver get OK");

        WebElement element=waitForElement("webmain",3000);
        System.out.println("successfully started into main app");
        driver.quit();
    }
    /**
     * start into main app and switch to webview
     */
    private void startIntoMain() throws Exception {
        startSelendroidServer(false);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        System.out.println("##driver get OK");

        WebElement element=waitForElement("webmain",3000);
        System.out.println("successfully started into main app");
        driver.switchTo().window("WEBVIEW");
    }

    @Test
    public void a3StatusPage() throws Exception{
        startIntoMain();
        WebElement el=driver.findElement(By.id("avb_ShowStatus"));
        el.click();
        el=waitForVisibleElement("avi_statuspage",2000);
        driver.quit();

    }

    public void startSelendroidServer(boolean clearData) throws Exception {
        /*
        if (selendroidServer != null) {
            selendroidServer.stopSelendroid();
        }
        SelendroidConfiguration config = new SelendroidConfiguration();

        selendroidServer = new SelendroidLauncher(config);
        selendroidServer.launchSelendroid();
        */

        SelendroidCapabilities caps = new SelendroidCapabilities("de.wellenvogel.avnav.main:1.0.0");
        caps.setEmulator(true);
        if (clearData){
            ArrayList<String> commands=new ArrayList<String>();
            commands.add("shell pm clear de.wellenvogel.avnav.main");
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
        /*
        if (selendroidServer != null) {
            selendroidServer.stopSelendroid();
        }
        */
    }
}

