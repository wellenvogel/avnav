#! /usr/bin/env python3
import socket
import sys
addr=sys.argv[1]
port=int(sys.argv[2])
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
for line in sys.stdin:
  sock.sendto(line.encode('utf-8'), (addr, port))
