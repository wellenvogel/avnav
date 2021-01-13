#! /usr/bin/env python3
import sys
import re
from bluetooth import *
import socket

#open a listener and wait for the connection

listener=socket.socket()
port=0
if len(sys.argv) > 1:
  port=int(sys.argv[1])
listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
listener.bind(('localhost',port))
listener.listen(1)
print("listening at"+str(listener.getsockname()))

outsock,addr=listener.accept()

print("client connected from ",str(addr))

print("start inquiry")
service_matches = find_service( 
                                uuid = SERIAL_PORT_CLASS )

if len(service_matches) == 0:
    print("couldn't find the service!")
    sys.exit(1)

first_match = service_matches[0]
port = first_match["port"]
name = first_match["name"]
host = first_match["host"]

print("connecting to ", host)

sock=BluetoothSocket( RFCOMM )
sock.connect((host, port))
#sock.send("PyBluez client says Hello!!")
buffer=""
while True:
  data = sock.recv(1024)
  if len(data) == 0:
    print("connection to "+str(host)+" lost")
    break
  buffer=buffer+data.decode(errors='ignore')
  lines=re.findall('([^\n]*\n)',buffer)
  buffer=re.sub('([^\n]*\n)','',buffer)
  for l in lines:
    print("received: ", l)
    outsock.sendall(l)
sock.close()
