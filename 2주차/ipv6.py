s = input()

if "::" in s:
    left, right = s.split("::")

    left = left.split(":") if left != "" else []
    right = right.split(":") if right != "" else []

    for i in range(len(left)):
        left[i] = left[i].zfill(4)

    for i in range(len(right)):
        right[i] = right[i].zfill(4)

    zero = ["0000"] * (8 - len(left) - len(right))

    lst = left + zero + right

else:
    lst = s.split(":")
    for i in range(len(lst)):
        if lst[i] == '':
            lst[i] = '0000'
        else:
            lst[i] = lst[i].zfill(4)

count = 0
for i in lst:
    count += 1
    print(i, end="")
    
    if count != len(lst):
        print(":", end="")