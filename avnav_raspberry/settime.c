#include <sys/types.h>
#include <stdio.h>
#include <unistd.h>
int main(int argc, char **argv){
	if (argc<2){
		fprintf(stderr,"usage: %s timestamp\n",argv[0]);
		exit(1);
	}
	setuid(0);
	char buffer[200];
	snprintf(buffer,200,"date %s",argv[1]);
	int rt=system(buffer);
	snprintf(buffer,200,"service ntp restart");
	system(buffer);
	exit(rt);
}
