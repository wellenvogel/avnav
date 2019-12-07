package de.wellenvogel.avnav.main;

import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collection;

public interface INavRequestHandler {
    interface IJsonObect{
        JSONObject toJson() throws JSONException;
    }

    RequestHandler.ExtendedWebResourceResponse handleDownload(String name, Uri uri) throws Exception;

    /**
     * upload json data
     * @param postData the json string
     * @param name the name (optional, can be null)
     * @param ignoreExisting do not overwrite an existing file, return false
     * @return true if the file has been stored
     * @throws Exception
     */
    boolean handleUpload(String postData, String name,boolean ignoreExisting) throws Exception;

    /**
     * list the items
     * @return a list of items
     */
    Collection<? extends IJsonObect> handleList() throws Exception;

    /**
     * delet an item
     * @param name
     * @param uri
     * @return true if deleted
     * @throws Exception
     */
    boolean handleDelete(String name, Uri uri) throws Exception;

}
