package de.wellenvogel.avnav.appapi;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.util.List;

import de.wellenvogel.avnav.util.AvnUtil;

/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public interface IPluginAware {
    interface StreamProvider{
        InputStream getStream() throws FileNotFoundException, IOException;
        long getSize();
        long lastModified();
        String downloadName();
    }

    class FileStreamProvider implements StreamProvider{
        File file;
        String name;
        public FileStreamProvider(File file){
            this.file=file;
        }
        public FileStreamProvider(File file,String name){
            this.file=file;
            this.name=name;
        }

        @Override
        public InputStream getStream() throws FileNotFoundException, IOException {
            return new FileInputStream(file);
        }

        @Override
        public long getSize() {
            return file.length();
        }

        @Override
        public long lastModified() {
            return file.lastModified();
        }

        @Override
        public String downloadName() {
            return (name != null)?name:file.getName();
        }
    }

    public static class PluginItem implements AvnUtil.IJsonObect {
        String name;
        JSONObject properties;
        long time;
        StreamProvider provider;
        public PluginItem(String name, JSONObject properties){
            this.name=name;
            this.properties=properties;
        }
        public PluginItem(String name, JSONObject properties, StreamProvider provider){
            this.name=name;
            this.properties=properties;
            this.provider=provider;
        }

        @Override
        public JSONObject toJson() throws JSONException, UnsupportedEncodingException {
            JSONObject rt;
            if (properties != null){
                rt=new JSONObject(properties.toString());
            }
            else{
                rt=new JSONObject();
            }
            rt.put("name",name);
            rt.put("canDownload",provider!=null);
            return rt;
        }
    }

    void removePluginItems(String pluginName,boolean finalCleanup);
    void setPluginItems(String pluginName, List<PluginItem> items) throws Exception;
}
