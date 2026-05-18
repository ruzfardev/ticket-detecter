import { ComponentType, ReactNode } from "react";
import { Stack } from "./Stack";

type IconLike = ComponentType<any>;

type Props = {
  icon: IconLike;
  size?: number;
  gap?: 1 | 2 | 3;
  color?: string;
  children: ReactNode;
};

export function IconText({ icon: Icon, size = 18, gap = 2, color, children }: Props) {
  return (
    <Stack inline gap={gap} align="center">
      <Icon size={size} strokeWidth={1.75} color={color} />
      <span>{children}</span>
    </Stack>
  );
}
