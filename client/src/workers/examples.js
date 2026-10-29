export const examples = {
  javascript: {
    source:
      'let arr = input.values;\nlet sum = 0;\nfor (let i = 0; i < arr.length; i++) {\n  sum += arr[i];\n}\nconsole.log("Sum:", sum);',
    input: { values: [4, 2, 7, 1] },
    visualVariable: 'arr',
  },
  java: {
    source:
      'public class Main {\n  public static void main(String[] args) {\n    int[] arr = {4, 2, 7, 1};\n    int sum = 0;\n    for (int i = 0; i < arr.length; i++) {\n      sum += arr[i];\n    }\n    System.out.println("Sum: " + sum);\n  }\n}',
    input: {},
    visualVariable: 'arr',
  },
  c: {
    source:
      '#include <stdio.h>\nint main() {\n  int arr[] = {4, 2, 7, 1};\n  int sum = 0;\n  for (int i = 0; i < 4; i++) {\n    sum += arr[i];\n  }\n  printf("Sum: %d\\n", sum);\n  return 0;\n}',
    input: {},
    visualVariable: 'arr',
  },
};
