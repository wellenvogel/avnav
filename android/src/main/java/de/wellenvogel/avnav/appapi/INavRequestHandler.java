package de.wellenvogel.avnav.appapi;

import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.FileNotFoundException;

public interface INavRequestHandler {

    ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception;

    /**
     * upload json data
     * @param postData the json string
     * @param name the name (optional, can be null)
     * @param ignoreExisting do not overwrite an existing file, return false
     * @return true if the file has been stored
     * @throws Exception
     */
    boolean handleUpload(PostVars postData, String name,boolean ignoreExisting) throws Exception;

    /**
     * list the items
     * @return a list of items
     * @param uri
     * @param serverInfo
     */
    JSONArray handleList(Uri uri, RequestHandler.ServerInfo serverInfo) throws Exception;

    /**
     * delet an item
     * @param name
     * @param uri
     * @return true if deleted
     * @throws Exception
     */
    boolean handleDelete(String name, Uri uri) throws Exception;

    JSONObject handleApiRequest(Uri uri, PostVars postData, RequestHandler.ServerInfo serverInfo) throws Exception;

    /**
     * handle a direct request if our prefix matches
     * @param uri
     * @param handler
     * @param method
     * @return
     * @throws FileNotFoundException
     */
    ExtendedWebResourceResponse handleDirectRequest(Uri uri, RequestHandler handler, String method) throws Exception;

    /**
     * get the prefix string we handle
     * @return
     */
    String getPrefix();
}
