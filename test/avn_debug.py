import sys
sys.path.append(r'/home/pi/avnav/pydev')
import pydevd
from avnav_server import *
pydevd.settrace(host='10.222.10.45',stdoutToServer=True, stderrToServer=True)

main(sys.argv)
