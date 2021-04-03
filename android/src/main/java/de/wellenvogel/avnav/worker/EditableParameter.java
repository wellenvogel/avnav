package de.wellenvogel.avnav.worker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import de.wellenvogel.avnav.util.AvnUtil;

public class EditableParameter {

    public static interface ListBuilder<T>{
        List<T> buildList(StringListParameter param);
    }
    public static interface EditableParameterInterface{
        public String getType();
        public String getName();
        public JSONObject toJson() throws JSONException;
        public void checkJson(JSONObject o) throws JSONException;
    }
    public static abstract class EditableParameterBase<T> implements AvnUtil.IJsonObect,EditableParameterInterface {
        String name;
        T defaultValue;
        String description;
        boolean mandatory=false;

        EditableParameterBase(String name, String description, T defaultValue) {
            this.name = name;
            this.description = description;
            this.defaultValue = defaultValue;
            mandatory = defaultValue == null;

        }
        EditableParameterBase(String name) {
            this.name = name;
            mandatory=true;
        }
        @Override
        public String getName() {
            return name;
        }
        @Override
        public void checkJson(JSONObject o) throws JSONException {
            fromJson(o);
        }
        public abstract String getType();
        abstract T fromJson(JSONObject o) throws JSONException;
        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt = new JSONObject();
            rt.put("name", name);
            rt.put("type", getType());
            rt.put("default",defaultValue);
            rt.put("editable",true);
            rt.put("mandatory",mandatory);
            if (description != null) rt.put("description",description);
            return rt;
        }
    }
    public static class StringParameter extends EditableParameterBase<String>{
        StringParameter(String name, String description, String defaultValue) {
            super(name, description, defaultValue);
        }

        StringParameter(String name) {
            super(name);
        }

        @Override
        public String getType() {
            return "STRING";
        }

        @Override
        String fromJson(JSONObject o) throws JSONException {
            return mandatory?o.getString(name):o.optString(name,defaultValue);
        }
    }
    public static class IntegerParameter extends EditableParameterBase<Integer>{
        IntegerParameter(String name, String description, Integer defaultValue) {
            super(name, description, defaultValue);
        }

        IntegerParameter(String name) {
            super(name);
        }

        @Override
        public String getType() {
            return "NUMBER";
        }

        @Override
        Integer fromJson(JSONObject o) throws JSONException {
            return (mandatory||o.has(name))?o.getInt(name):o.optInt(name,defaultValue);
        }
    }
    public static class BooleanParameter extends EditableParameterBase<Boolean>{
        BooleanParameter(String name, String description, Boolean defaultValue) {
            super(name, description, defaultValue);
        }
        BooleanParameter(String name) {
            super(name);
        }
        @Override
        public String getType() {
            return "BOOLEAN";
        }

        @Override
        Boolean fromJson(JSONObject o) throws JSONException {
            return (mandatory||o.has(name))?o.getBoolean(name):o.optBoolean(name,defaultValue);
        }
    }
    public static class FloatParameter extends EditableParameterBase<Float>{
        FloatParameter(String name, String description, Float defaultValue) {
            super(name, description, defaultValue);
        }
        FloatParameter(String name) {
            super(name);
        }
        @Override
        public String getType() {
            return "FLOAT";
        }

        @Override
        Float fromJson(JSONObject o) throws JSONException {
            return (mandatory||o.has(name))?(float)o.getDouble(name):(float)o.optDouble(name,defaultValue);
        }
    }
    public static class StringListParameter extends EditableParameterBase<String>{
        public List<String> list;
        public ListBuilder<String> listBuilder=null;
        StringListParameter(String name, String description, String defaultValue,List<String> values) {
            super(name, description, defaultValue);
            list=values;
        }
        StringListParameter(String name,String description){
            super(name,description,null);
        }
        StringListParameter(String name, String description, String defaultValue,String... values) {
            super(name, description, defaultValue);
            list=new ArrayList<String>();
            list.addAll(Arrays.asList(values));
        }
        StringListParameter(String name,List<String> values) {
            super(name);
            list=values;
        }
        @Override
        public String getType() {
            return "LIST";
        }

        @Override
        String fromJson(JSONObject o) throws JSONException {
            return mandatory?o.getString(name):o.optString(name,defaultValue);
        }

        @Override
        public JSONObject toJson() throws JSONException {
            JSONObject rt=super.toJson();
            if (listBuilder != null){
                list=listBuilder.buildList(this);
            }
            if (list != null){
                JSONArray liarr=new JSONArray();
                for (String i : list){
                    liarr.put(i);
                }
                rt.put("rangeOrList",liarr);
            }
            return rt;
        }
    }
    public static class ParameterList extends ArrayList<EditableParameterInterface>{
        public JSONArray toJson() throws JSONException {
            JSONArray rt=new JSONArray();
            for (EditableParameterInterface i : this){
                rt.put(i.toJson());
            }
            return rt;
        }
        public void check(JSONObject o) throws JSONException{
            for (EditableParameterInterface i:this){
                i.checkJson(o);
            }
        }
        public ParameterList(EditableParameterInterface... param){
            this.addAll(Arrays.asList(param));
        }
        public void addParams(EditableParameterInterface... param){
            this.addAll(Arrays.asList(param));
        }
    }
}