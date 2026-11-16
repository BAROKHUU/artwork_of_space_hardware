import { StoryBook } from './StoryBook';
import type { Chapter } from '../data/types';
import type { StorySection } from './types';

interface GameplayStoryProps {
  chapter: Chapter;
  section: StorySection;
  onContinue: () => void;
  inPlace?: boolean;
}

/** Shows only the dialogue beat currently reached by gameplay. */
export function GameplayStory({ chapter, section, onContinue, inPlace }: GameplayStoryProps) {
  return (
    <StoryBook
      chapter={chapter}
      sections={[section]}
      mode="game"
      inPlace={inPlace}
      activeSectionId={section.id}
      onContinue={onContinue}
      onSkip={onContinue}
    />
  );
}
