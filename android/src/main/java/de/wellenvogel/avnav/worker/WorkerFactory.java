package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;

import java.io.IOException;
import java.util.HashMap;

import de.wellenvogel.avnav.util.NmeaQueue;

public class WorkerFactory {
    public static final String ANDROID_NAME="InternalGPS";
    public static final String USB_NAME="UsbConnection";
    public static final String SOCKETREADER_NAME="SocketReader";
    public static final String BLUETOOTH_NAME="Bluetooth";
    private static final WorkerFactory instance=new WorkerFactory();
    public static WorkerFactory getInstance(){return instance;}
    public static class WorkerNotFound extends Exception{
        public WorkerNotFound(String name) {
            super("Worker "+name+" not found");
        }
    }
    public WorkerFactory(){
        AndroidPositionHandler.register(this,ANDROID_NAME);
        SocketReader.register(this,SOCKETREADER_NAME);
        UsbConnectionHandler.register(this,USB_NAME);
        BluetoothConnectionHandler.register(this,BLUETOOTH_NAME);

    }
    private HashMap<String, Worker.WorkerCreator> workers=new HashMap<>();
    void registerCreator(Worker.WorkerCreator creator){
        workers.put(creator.name,creator);
    }
    public Worker.WorkerCreator getCreator(String name){
        return workers.get(name);
    }
    public Worker createWorker(String name,Context ctx, NmeaQueue queue) throws WorkerNotFound, JSONException, IOException {
        Worker.WorkerCreator cr=getCreator(name);
        if ( cr == null) throw new WorkerNotFound(name);
        return cr.create(ctx,queue);
    }
}
