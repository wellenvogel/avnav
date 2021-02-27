some install hints on OSX
my testenv: osx 10.6.8
1. for the SW itself:
1.1. new python (2.7.4) from https://www.python.org/download/ (https://www.python.org/ftp/python/2.7.6/python-2.7.6-macosx10.6.dmg)
1.2. gdal from http://www.kyngchaos.com/software/frameworks#gdal_complete - currently 1.9 (http://www.kyngchaos.com/files/software/frameworks/GDAL_Complete-1.9.dmg)
     make it available for python 2.7:
     sudo mkdir -p /Library/Python/2.7/site-packages
     sudo cp /Library/Python/2.6/site-packages/gdal-py2.6.pth /Library/Python/2.7/site-packages/gdal-py2.7.pth
     sudo nano /Library/Python/2.7/site-packages/gdal-py2.7.pth , replace 2.6 by 2.7, ^X
1.3. PIL from http://www.kyngchaos.com/software/archive?s[]=pil 1.1.7.4 (http://www.kyngchaos.com/files/software/python/PIL-1.1.7-4.dmg)
     install freetype as prereq. : http://www.kyngchaos.com/files/software/frameworks/FreeType_Framework-2.4.10-1.dmg

2. for the closure compiler - JDK 7
   follow the description at http://jksha.blogspot.se/2013/09/java-7-and-snow-leopard-osx-106.html
   i.e. change (temporarily) the OS version by editing /System/Library/CoreServices/SystemVersion.plist
   before installing Java, afterwards change it back
   install JDK 1.7 from http://www.oracle.com/technetwork/java/javase/downloads/jdk7-downloads-1880260.html
   then click on /Library/Java/JavaVirtualMachines/xxx.jdk and change the order of sdks (1.7. top)

