
import sys
input = sys.stdin.readline




left = list(input().rstrip())
right = []


    
num = int(input())
#명령어 실행 횟수 입력받기

for i in range(num):
    command = input().split()
    #명령어 입력받기
    
    if command[0] == 'L':
        #커서 왼쪽으로 이동
        if left:
            right.append(left.pop())
        pass
    elif command[0] == 'D':
        #커서 오른쪽으로 이동
        if right:
            left.append(right.pop())
        pass
    elif command[0] == 'B':
        #커서 왼쪽에 있는 문자 삭제
        if left:
            left.pop()
        pass
    elif command[0] == 'P':
        #문자 추가
        left.append(command[1])
        pass
        



print(''.join(left + right[::-1]))