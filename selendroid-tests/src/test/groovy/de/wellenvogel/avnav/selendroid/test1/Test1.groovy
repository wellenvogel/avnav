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

import org.junit.*;
import org.junit.runners.MethodSorters;
import org.openqa.selenium.By;
import org.openqa.selenium.ElementNotVisibleException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.io.File;
import java.util.ArrayList;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class Test1 extends TestBase{
    private int startcount=0;


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
        //Thread.sleep(2000);
        element=waitForVisibleElement("headers",2000);
        element=driver.findElement(By.id("action_ok"));
        element.click();
        //Thread.sleep(7000);
        element=waitForVisibleElement("webmain",7000);
        System.out.println("successfully started into main app");
    }

    @Test
    public void a2startApp2() throws Exception {
        startSelendroidServer(false,"settingsInternal.xml",null);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        System.out.println("##driver get OK");

        WebElement element=waitForElement("webmain",3000);
        System.out.println("successfully started into main app");
        driver.quit();
    }
    @Test
    public void a3startAppIp() throws Exception {
        startSelendroidServer(false,"settingsIp.xml",null);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        System.out.println("##driver get OK");

        WebElement element=waitForElement("webmain",3000);
        System.out.println("successfully started into main app");
        driver.quit();
    }


    /**
     * start into main app and switch to webview
     */
    private void startIntoMain(String settings,Map<String,String> replace) throws Exception {
        startSelendroidServer(false,settings,replace);
        driver.get("and-activity://de.wellenvogel.avnav.MainActivity");
        System.out.println("##driver get OK");

        WebElement element=waitForElement("webmain",3000);
        System.out.println("successfully started into main app");
        driver.switchTo().window("WEBVIEW");
    }

    @Test
    public void b1StatusPage() throws Exception{
        startIntoMain("settingsInternal.xml",null)
        WebElement el=driver.findElement(By.id("avb_ShowStatus"));
        el.click();
        el=waitForVisibleElement("avi_statuspage",2000);
        driver.quit();

    }

    @Test
    public void b2StatusPageIp() throws Exception{
        startIntoMain("settingsIp.xml",null)
        WebElement el=driver.findElement(By.id("avb_ShowStatus"));
        el.click();
        el=waitForVisibleElement("avi_statuspage",2000);
        driver.quit();

    }

}

