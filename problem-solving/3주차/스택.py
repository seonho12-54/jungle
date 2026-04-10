import sys
input = sys.stdin.readline

num = int(input())
lst = []
result = []

for _ in range(num):
    clk = input().split()

    if clk[0] == 'push':
        lst.append(int(clk[1]))

    elif clk[0] == 'pop':
        if len(lst) == 0:
            result.append('-1')
        else:
            result.append(str(lst.pop()))

    elif clk[0] == 'size':
        result.append(str(len(lst)))

    elif clk[0] == 'empty':
        if len(lst) == 0:
            result.append('1')
        else:
            result.append('0')

    elif clk[0] == 'top':
        if len(lst) == 0:
            result.append('-1')
        else:
            result.append(str(lst[-1]))

print('\n'.join(result))