#include <stdio.h>
#include <sys/syscall.h>

int main(void)
{
    printf("%d\n", SYS_gettid);
    return 0;
}
