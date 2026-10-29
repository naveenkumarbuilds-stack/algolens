#include <stdio.h>
int main() {
  int arr[] = {4, 2, 7, 1};
  int sum = 0;
  for (int i = 0; i < 4; i++) {
    sum += arr[i];
  }
  printf("Sum: %d\n", sum);
  return 0;
}
