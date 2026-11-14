import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("ai-chat");
}

export default function Page() {
  return <LabBoardPage board="ai-chat" />;
}
