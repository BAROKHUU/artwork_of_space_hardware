import { StoryBook } from './StoryBook';
import type { Chapter } from '../data/types';
import type { StorySection } from './types';

interface GameplayStoryProps {
  chapter: Chapter;
  section: StorySection;
  onContinue: () => void;
}

/** Shows only the dialogue beat currently reached by gameplay. */
export function GameplayStory({ chapter, section, onContinue }: GameplayStoryProps) {
  return (
    <StoryBook
      chapter={chapter}
      sections={[section]}
      mode="game"
      activeSectionId={section.id}
      onContinue={onContinue}
      onSkip={onContinue}
    />
  );
}
