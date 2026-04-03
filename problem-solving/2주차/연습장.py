def departure_day(n):
    if n == 1:
        return 1
    departure_day(  n-1   )+1