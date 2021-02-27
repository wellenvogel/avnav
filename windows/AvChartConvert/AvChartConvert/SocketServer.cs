using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace AvChartConvert
{
    class SocketServer 
    {
        private string filename;
        private int port;
        private bool doStop = false;
        private TcpListener listenerSocket;
        private int waittime; //ms
        Thread listener;
        public SocketServer(string filename, int port, int waittime)
        {
            this.filename = filename;
            this.waittime = waittime;
            this.port = port;
        }
        public void start()
        {
            listener = new Thread(listen);
            listenerSocket = new TcpListener(port);
            listenerSocket.Start();
            listener.Start();
        }

        private void listen()
        {
            while (!doStop)
            {
                try {
                    Socket client = listenerSocket.AcceptSocket();
                    Thread cHandler = new Thread(new ParameterizedThreadStart(handleClient));
                    cHandler.Name = "ClientHandler " + client.RemoteEndPoint.ToString();
                    cHandler.Start(client);
                }catch (Exception e)
                {
                    Console.WriteLine("listener Exception " + e.ToString());
                }
            }
        }

        private void handleClient(object socketp)
        {
            Socket socket = (Socket)socketp;
            using (StreamReader rd=new StreamReader(filename))
            {
                string line = rd.ReadLine();
                try {
                    while (line != null && !doStop)
                    {
                        line += "\r\n";
                        Console.WriteLine("sending: " + line);
                        byte[] buffer = System.Text.Encoding.ASCII.GetBytes(line);
                        if (doStop) break;
                        socket.Send(buffer);
                        if (doStop) break;
                        Thread.Sleep(waittime);
                        line = rd.ReadLine();
                    }
                }catch (Exception e)
                {
                    Console.WriteLine("exception while writing: " + e.ToString());
                }
                socket.Close();
            }
        }
        public void stop()
        {
            doStop = true;
            try
            {
                listenerSocket.Stop();
                listener.Interrupt();
            }
            catch (Exception e) { }
        }
    }
    
}
