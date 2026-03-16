
white = 0
blue = 0


def colorpaper(x, y , num):
    global white, blue
    
    color = matrix[x][y]
   
   
    for i in range(x, x+num):
        for k in range(y, y+num):
            if color != matrix[i][k]:
                mid = num //2
                n1 = colorpaper( x, y, mid)
                n2 = colorpaper( x, y+mid, mid)
                n3 = colorpaper( x+mid, y, mid)
                n4 = colorpaper( x+mid, y+mid, mid)
                
                return


    if color == 0:
        white +=1
    else:
        blue +=1
    
    







num = int(input())

matrix = [list(map(int, input().split())) for _ in range(num)]


#잘라진 색종이중에 파란게 있으면 카운트1 없으면 없는걸로 카운트 0

colorpaper( 0, 0, num)


print(white)
print(blue)