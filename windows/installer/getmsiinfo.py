from msilib import *
import sys
def GetMsiProperty(path ,property):
    db = OpenDatabase(path, MSIDBOPEN_READONLY)
    view = db.OpenView ("SELECT Value FROM Property WHERE Property='" + property + "'")
    view.Execute(None)
    result = view.Fetch()
    #print dir(result)
    return result.GetString(1)

print "open: "+sys.argv[1]
msiVersion = GetMsiProperty(sys.argv[1] ,sys.argv[2])
print sys.argv[2]+"="+msiVersion
