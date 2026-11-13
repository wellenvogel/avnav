# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2026 Andreas Vogel andreas@wellenvogel.net
#
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
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py
###############################################################################
import http.client
import logging
import socket
import ssl
import sys
import threading
import urllib.request
from copy import copy
from typing import Callable, Mapping, Optional

from avnav_util import AVNLog

# Signatur: (fetched_bytes, total_bytes, percent) -> None
ProgressCallback = Callable[[int, Optional[int], Optional[float]], None]


class CancelableHTTPConnection(http.client.HTTPConnection):

  def __init__(
      self,
      host: str,
      port: Optional[int] = None,
      timeout: Optional[float] = socket._GLOBAL_DEFAULT_TIMEOUT,  # type: ignore
      source_address: Optional[tuple[str, int]] = None,
      blocksize: int = 8192,
      *,
      cancel_event: Optional[threading.Event] = None,
      sock_callback: Optional[Callable[[socket.socket], None]] = None,
  ) -> None:
    super().__init__(
        host,
        port=port,
        timeout=timeout,
        source_address=source_address,
        blocksize=blocksize,
    )
    self.cancel_event = cancel_event
    self.sock_callback = sock_callback

  def _connect_socket(self) -> socket.socket:
    addr_info = socket.getaddrinfo(
        self.host, self.port, 0, socket.SOCK_STREAM
    )
    last_err: Optional[OSError] = None

    for family, socktype, proto, _canonname, sockaddr in addr_info:
      if self.cancel_event and self.cancel_event.is_set():
        raise InterruptedError("Request canceled before connecting")

      sock: Optional[socket.socket] = None
      try:
        sock = socket.socket(family, socktype, proto)
        if self.timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
          sock.settimeout(self.timeout)
        if self.source_address:
          sock.bind(self.source_address)

        # Socket registrieren, BEVOR der blockierende TCP-Handshake startet
        self.sock = sock
        if self.sock_callback:
          self.sock_callback(sock)

        sock.connect(sockaddr)
        return sock

      except OSError as e:
        last_err = e
        if sock is not None:
          try:
            sock.close()
          except OSError:
            pass
        self.sock = None
        if self.cancel_event and self.cancel_event.is_set():
          raise InterruptedError("Request canceled during connect") from e

    if last_err is not None:
      raise last_err
    raise OSError("getaddrinfo returned an empty list")

  def connect(self) -> None:
    self.sock = self._connect_socket()
    if self._tunnel_host:
      self._tunnel()


class CancelableHTTPSConnection(
    CancelableHTTPConnection, http.client.HTTPSConnection
):

  def __init__(
      self,
      host: str,
      port: Optional[int] = None,
      *,
      timeout: Optional[float] = socket._GLOBAL_DEFAULT_TIMEOUT,  # type: ignore
      source_address: Optional[tuple[str, int]] = None,
      context: Optional[ssl.SSLContext] = None,
      blocksize: int = 8192,
      cancel_event: Optional[threading.Event] = None,
      sock_callback: Optional[Callable[[socket.socket], None]] = None,
  ) -> None:
    http.client.HTTPSConnection.__init__(
        self,
        host,
        port=port,
        timeout=timeout,
        source_address=source_address,
        context=context,
        blocksize=blocksize,
    )
    self.cancel_event = cancel_event
    self.sock_callback = sock_callback

  def connect(self) -> None:
    CancelableHTTPConnection.connect(self)
    self.sock = self._context.wrap_socket(
        self.sock, server_hostname=self.host
    )
    if self.sock_callback:
      self.sock_callback(self.sock)


class CancelableHTTPHandler(urllib.request.HTTPHandler):

  def __init__(
      self,
      cancel_event: threading.Event,
      sock_callback: Callable[[socket.socket], None],
  ) -> None:
    super().__init__()
    self.cancel_event = cancel_event
    self.sock_callback = sock_callback

  def http_open(self, req: urllib.request.Request) -> http.client.HTTPResponse:
    return self.do_open(
        lambda host, **kw: CancelableHTTPConnection(
            host,
            cancel_event=self.cancel_event,
            sock_callback=self.sock_callback,
            **kw,
        ),
        req,
    )


class CancelableHTTPSHandler(urllib.request.HTTPSHandler):

  def __init__(
      self,
      cancel_event: threading.Event,
      sock_callback: Callable[[socket.socket], None],
  ) -> None:
    super().__init__()
    self.cancel_event = cancel_event
    self.sock_callback = sock_callback

  def https_open(self, req: urllib.request.Request) -> http.client.HTTPResponse:
    return self.do_open(
        lambda host, **kw: CancelableHTTPSConnection(
            host,
            cancel_event=self.cancel_event,
            sock_callback=self.sock_callback,
            **kw,
        ),
        req,
    )


class CancelableRedirectHandler(urllib.request.HTTPRedirectHandler):

  def __init__(
      self,
      cancel_event: threading.Event,
      reset_callback: Callable[[], None],
  ) -> None:
    super().__init__()
    self.cancel_event = cancel_event
    self.reset_callback = reset_callback

  def redirect_request(
      self,
      req: urllib.request.Request,
      fp,
      code: int,
      msg: str,
      headers: http.client.HTTPMessage,
      newurl: str,
  ) -> Optional[urllib.request.Request]:
    if self.cancel_event.is_set():
      raise InterruptedError("Request canceled before following redirect")

    if self.reset_callback:
      self.reset_callback()

    return super().redirect_request(req, fp, code, msg, headers, newurl)


class CancelableRequest:

  def __init__(self) -> None:
    self.cancel_event = threading.Event()
    self._sock: Optional[socket.socket] = None
    self._lock = threading.Lock()
    self.opener = urllib.request.build_opener(
        CancelableHTTPHandler(self.cancel_event, self._set_sock),
        CancelableHTTPSHandler(self.cancel_event, self._set_sock),
        CancelableRedirectHandler(self.cancel_event, self._reset_sock),
    )

  def _reset_sock(self) -> None:
    with self._lock:
      self._sock = None

  def _set_sock(self, sock: socket.socket) -> None:
    with self._lock:
      self._sock = sock
      if self.cancel_event.is_set():
        self._close_sock()

  def _close_sock(self) -> None:
    if self._sock:
      try:
        self._sock.shutdown(socket.SHUT_RDWR)
      except OSError:
        pass
      try:
        self._sock.close()
      except OSError:
        pass

  @staticmethod
  def _parse_content_length(response: http.client.HTTPResponse) -> Optional[int]:
    raw_length = response.headers.get("Content-Length")
    if raw_length is None:
      return None
    try:
      length = int(raw_length)
      return length if length > 0 else None
    except ValueError:
      return None

  def fetch(
      self,
      url: str,
      outFile: str,
      method: str = "GET",
      headers: Optional[Mapping[str, str]] = None,
      data: Optional[bytes] = None,
      timeout: float = 30.0,
      on_progress: Optional[ProgressCallback] = None,
  ) -> Optional[bytes]:
    req = urllib.request.Request(
        url=url,
        data=data,
        headers=dict(headers) if headers else {},
        method=method.upper(),
    )

    try:
      with self.opener.open(req, timeout=timeout) as response:
        total_bytes = self._parse_content_length(response)
        fetched_bytes = 0
        with open(outFile, "wb") as out:

            if on_progress:
                initial_percent = 0.0 if total_bytes is not None else None
                on_progress(0, total_bytes, initial_percent)

            while not self.cancel_event.is_set():
                chunk = response.read(8192)
                if not chunk:
                    break
                out.write(chunk)
                fetched_bytes += len(chunk)

                if on_progress:
                    percent = (
                        min(100.0, (fetched_bytes / total_bytes) * 100.0)
                        if total_bytes is not None
                        else None
                    )
                    on_progress(fetched_bytes, total_bytes, percent)


    except (OSError, InterruptedError) as e:
      if self.cancel_event.is_set():
        print("Request aborted cleanly.")
        return None
      raise e
    finally:
      self._reset_sock()

  def cancel(self) -> None:
    with self._lock:
      self.cancel_event.set()
      self._close_sock()

'''
# --- Beispiel zur Verwendung ---
if __name__ == "__main__":
  req_controller = CancelableRequest()

  def show_progress(
      fetched: int, total: Optional[int], percent: Optional[float]
  ) -> None:
    if percent is not None and total is not None:
      print(f"Fortschritt: {fetched} / {total} Bytes ({percent:.1f}%)")
    else:
      print(f"Fortschritt: {fetched} Bytes (Gesamtgröße unbekannt)")

  custom_headers = {
      "User-Agent": "MyApp/1.0",
      "Accept": "application/json",
      "Authorization": "Bearer dein-token",
  }

  worker = threading.Thread(
      target=lambda: print(
          "Antwort:",
          req_controller.fetch(
              "https://httpbin.org",
              method="POST",
              headers=custom_headers,
              data=b'{"hello": "world"}',
              on_progress=show_progress,
          ),
      )
  )
  worker.start()
  worker.join()
'''
class DownloadProgress():
    def __init__(self):
        self.totalBytes = 0
        self.fetchedBytes = 0
        self.percent=0
        self.error=None
class AVNDownloadJob:
    def __init__(self,id, url:str,targetFile:str,method:str='GET',headers=None):
        self._targetFile = targetFile
        self._thread=None
        self._lock=threading.Lock()
        self._socket=None
        self._url=url
        self._method=method
        self._headers=headers
        self._controler=None
        self._progress=DownloadProgress()
        self.id=id

    def start(self):
        with self._lock:
            if self._thread is not None:
                return False
            self._thread=threading.Thread(target=self._run)
        self._thread.start()

    def _onProgress(self, fetched_bytes, total_bytes, percent):
        AVNLog.debug(f"{self._url} Fetched {fetched_bytes} / {total_bytes} Bytes")
        with self._lock:
            self._progress.fetchedBytes = fetched_bytes
            self._progress.totalBytes = total_bytes
            self._progress.percent = percent
    def _run(self):
        AVNLog.info("download started for %d: %s",self.id,self._url)
        try:
            with self._lock:
                self._controler=CancelableRequest()
            self._controler.fetch(self._url,self._targetFile, method=self._method,headers=self._headers,on_progress=self._onProgress)
            AVNLog.info("download complete for %d: %s",self.id,self._url)
        except Exception as e:
            AVNLog.error("download %d: %s error %s",self.id,self._url,str(e))
            with self._lock:
                self._progress.error=str(e)
        with self._lock:
            self._controler=None

    def isRunning(self):
        with self._lock:
            if self._thread is not None:
                return self._thread.is_alive()
            return False

    def stop(self):
        controler=None
        with self._lock:
            controler=self._controler
        if controler is not None:
            controler.cancel()

    def getProgress(self):
        with self._lock:
            return copy(self._progress)


class AVNDownloadManager:
    def __init__(self):
        self._lock=threading.Lock()
        self._id=0
        self._running=None

    def _getId(self):
        self._id = self._id+1
        return self._id

    def start(self,url:str,filename:str,method='GET',header=None):
        id=None
        with self._lock:
           if self._running is not None:
               if self._running.isRunning():
                    raise Exception(f"unable to start download for {url}: Already running")
               self._running=None
           id=self._getId()
           self._running = AVNDownloadJob(id,url,filename,method,header)
        self._running.start()
        return id

    def status(self,id):
        with self._lock:
            if self._running is not None and self._running.id == id:
                if self._running.isRunning():
                    return self._running.getProgress()
                self._running=None
                return None


if __name__ == '__main__':
    AVNLog.initLoggingInitial(logging.DEBUG)
    avn=AVNDownloadManager()
    avn.start(sys.argv[1],sys.argv[2])