import { Avatar } from "@/components/ui/heroui-avatar";

const users = [
  {
    id: 1,
    name: "John Doe",
    src: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    fallback: "JD",
  },
  {
    id: 2,
    name: "Kate Wilson",
    src: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
    fallback: "KW",
  },
  {
    id: 3,
    name: "Emily Chen",
    src: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
    fallback: "EC",
  },
  {
    id: 4,
    name: "Michael Brown",
    src: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg",
    fallback: "MB",
  },
];

export default function AvatarGroupDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-8">
      <div className="flex flex-col gap-6">
        <div className="flex -space-x-2">
          {users.map((user) => (
            <Avatar key={user.id} className="ring-2 ring-background">
              <Avatar.Image alt={user.name} src={user.src} />
              <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
            </Avatar>
          ))}
        </div>
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user) => (
            <Avatar key={user.id} className="ring-2 ring-background">
              <Avatar.Image alt={user.name} src={user.src} />
              <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
            </Avatar>
          ))}
          <Avatar className="ring-2 ring-background">
            <Avatar.Fallback>+2</Avatar.Fallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

export { AvatarGroupDemo };
