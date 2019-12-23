#!/usr/bin/env python
"""
an uploader to sync files via sftp
needs:
sudo apt-get install python-keyring
sudo pip install pysftp

"""
import hashlib
import keyring
import argparse
import os
import re
import sys
import pysftp
parser = argparse.ArgumentParser(description='upload files via sftp')
parser.add_argument('--mode', type=str,
                    help='modes: password|listpass|deletepass|upload|check')
parser.add_argument('--exclude',type=str,action='append',help='add exclude names (no wildcards,complete pathes)')

PWFOLDER="uploadSync"
MD5FILE="__uploadMd5"

def init_keyring():
  keyring.set_keyring(keyring.backends.kwallet.DBusKeyring())

def store_credential(host,user,password):
  init_keyring()
  keyring.set_password(PWFOLDER,user+"@"+host,password)

def list_passwords():
  init_keyring()
  keyring.get_password(PWFOLDER,"dummy") #just connect
  k=keyring.get_keyring()
  list=k.iface.entryList(k.handle,PWFOLDER,k.appid)
  return list

def delete_pass(name):
  init_keyring()
  keyring.delete_password(PWFOLDER,name)

def get_pass(host,user=None):
  init_keyring()
  if user is None:
    list=list_passwords()
    for el in list:
      luser,lhost=el.split("@")
      if lhost == host:
        if user is not None:
          raise Exception("more than one entry found for remote system %s"%host)
        user=luser
  if user is None:
    raise Exception("no entry found for remote system %s"%host)
  pw=keyring.get_password(PWFOLDER,user+"@"+host)
  if pw is None:
    raise Exception("no password found for user %s at %s"%(user,host))


def split_remote(remote):
  """
  split a remote address user@host:/dir
  :param remote:
  :return: user,host,dir
  """
  l1=remote.split(":",1)
  if len(l1) < 2:
    raise Exception("missing host in %s"%remote)
  dir=l1[1]
  l2=l1[0].split("@",1)
  host=l1[0]
  user=None
  if len(l2) > 1:
    host=l2[1]
    user=l2[0]
  return (user,host,dir)

def check_remote(remote):
  user,host,dir=split_remote(remote)
  password=get_pass(host,user)
  with pysftp.Connection(host, username=user, password=password) as sftp:
    dir=dir+"/"
    if not sftp.exists(dir):
      raise Exception("remote dir %s not found"%dir)
    with sftp.cd(dir):
      if not sftp.exists(MD5FILE):
        return None
      f=sftp.open(MD5FILE)
      if f is None:
        return None
      return f.read()

def md5(fname):
  hash_md5 = hashlib.md5()
  with open(fname, "rb") as f:
    for chunk in iter(lambda: f.read(4096), b""):
      hash_md5.update(chunk)
  return hash_md5.hexdigest()

def is_excluded(path,excludes=None):
  if excludes is not None:
    for e in excludes:
      if e == path:
        return True
  return False

def create_md5(localDir,excludes=None,prefix=None):
  if not os.path.isdir(localDir):
    raise Exception("%s is no directory"%localDir)
  sums=[]
  for f in os.listdir(localDir):
    if f == MD5FILE:
      continue
    fname=os.path.join(localDir,f)
    if is_excluded(fname,excludes):
      continue
    nprefix = f
    if prefix is not None:
      nprefix = prefix + "/" + f
    if os.path.isdir(fname):
      sums+=create_md5(fname,excludes,nprefix)
    else:
      sum=md5(fname)
      sums.append((sum,nprefix))
  return sums

def write_md5(localDir,excludes=None):
  sums=create_md5(localDir,excludes)
  md5_path=os.path.join(localDir,MD5FILE)
  if os.path.exists(md5_path):
    os.unlink(md5_path)
  with open(md5_path,"w") as f:
    for s in sums:
      f.write("%30s %s\n"%(s[0],s[1]))
  return sums

def parse_sums(sums):
  rt={}
  for s in sums:
    la=re.split("  *",s)
    if len(la) < 2:
      continue
    rt[la[1]]=la[0]
  return rt

def find_uploads(localDir,remote,excludes=None):
  sums=write_md5(localDir,excludes)
  remote_sums=check_remote(remote)
  if remote_sums is None:
    remote_sums=[]
  else:
    remote_sums=remote_sums.split("\n")
  local_hash={}
  for s in sums:
    local_hash[s[1]]=s[0]
  remote_hash=parse_sums(remote_sums)
  to_upload={}
  for k in local_hash.keys():
    if local_hash[k] != remote_hash.get(k):
      to_upload[k]=True
  for k in remote_hash.keys():
    if remote_hash[k] != local_hash.get(k):
      to_upload[k]=True
  return to_upload.keys()


def upload_files(localDir,remote,list):
  if not os.path.isdir(localDir):
    raise Exception("%s is not directory")
  for l in list:
    fname=os.path.join(localDir,l)
    if not os.path.exists(fname):
      raise Exception("inconsistency: file %s from list does not exist"%fname)
  user, host, dir = split_remote(remote)
  password = get_pass(host, user)
  with pysftp.Connection(host, username=user, password=password) as sftp:
    dir = dir + "/"
    if not sftp.exists(dir):
      raise Exception("remote dir %s not found" % dir)
    with sftp.cd(dir):
      for f in list:
        print "uploading %s"%f
        rpath=None
        segs=f.split("/")
        if len(segs) > 1:
          rpath="/".join(segs[0:-1])+"/"
          if not sftp.exists(rpath):
            print "creating remote dir %s"%rpath
            sftp.makedirs(rpath,777)
        if sftp.exists(f):
          sftp.unlink(f)
        local_path=os.path.join(localDir,f)
        sftp.put(local_path,f,confirm=True)

def do_upload(localDir,remote):
  list=find_uploads(localDir,remote)
  print "found %d files to upload"%len(list)
  if len(list) < 1:
    return
  list.append(MD5FILE)
  upload_files(localDir,remote,list)

def main(argv):
  args,remain=parser.parse_known_args(argv)
  if args.mode == 'password':
    if len(remain) < 4:
      raise Exception("usage: uploadSync.py --mode password host user pass")
    store_credential(remain[1],remain[2],remain[3])
    return
  if args.mode == 'listpass':
    list=list_passwords()
    for e in list:
      print "%s" % e
    return
  if args.mode == 'deletepass':
    if len(remain) < 2:
      raise Exception("usage: uploadSync.py --mode deletepass user@host")
    delete_pass(remain[1])
    return
  if args.mode == 'check':
    if len(remain) < 2:
      raise Exception("usage: uploadSync.py --mode check [user@]host:/some/remote/dir")
    remote_md5=check_remote(remain[1])
    if remote_md5 is None:
      print "no remote file %s found"%MD5FILE
      sys.exit(1)
    for l in remote_md5.split("\n"):
      print l
    return
  if args.mode == 'upload':
    if len(remain) < 3:
      raise Exception("usage: uploadSync.py --mode upload localDir [user@]host:/some/remote/dir")
    do_upload(remain[1],remain[2])
    return
  if args.mode == 'md5':
    sums=create_md5(remain[1],args.exclude)
    for s in sums:
      print("%30s %s"%(s[0],s[1]))
    return
  if args.mode == 'wrmd5':
    write_md5(remain[1],args.exclude)
    print "%s written"%(os.path.join(remain[1],MD5FILE))
    return
  if args.mode == 'finduploads':
    list=find_uploads(remain[1],remain[2])
    for l in list:
      print l
    return
  raise Exception("unknown mode %s" % args.mode)
if __name__ == '__main__':
  main(sys.argv)
