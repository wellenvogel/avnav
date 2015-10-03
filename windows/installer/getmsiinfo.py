from msilib import *
import sys
def GetMsiProperty(path ,property):
    db = OpenDatabase(path, MSIDBOPEN_READONLY)
    if property == "PackageCode":
        return db.GetSummaryInformation(0).GetProperty(9)
    view = db.OpenView ("SELECT Value FROM Property WHERE Property='" + property + "'")
    view.Execute(None)
    result = view.Fetch()
    #print dir(result)
    return result.GetString(1)

print "open: "+sys.argv[1]
for p in ["ProductCode","PackageCode","ProductName","UpgradeCode"]:
    msiVersion = GetMsiProperty(sys.argv[1] ,p)
    print p+"="+msiVersion

