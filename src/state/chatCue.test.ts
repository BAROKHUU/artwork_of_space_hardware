import { beforeEach, describe, expect, it } from 'vitest';
import { useChatCue } from './chatCue';

describe('chatCue', () => {
  beforeEach(() => {
    useChatCue.setState({ popup: null, openReq: null });
  });

  it('gives fail pop-ups priority over intro pop-ups', () => {
    const introId = useChatCue.getState().showPopup({ kind: 'intro', textKey: 'chat.popup.intro1' });
    expect(introId).toBeTypeOf('number');
    expect(useChatCue.getState().popup?.kind).toBe('intro');

    const failId = useChatCue.getState().showPopup({
      kind: 'fail',
      textKey: 'chat.popup.failQuiz',
      prefill: 'Help me with Q1',
    });
    expect(failId).toBeTypeOf('number');
    expect(useChatCue.getState().popup?.kind).toBe('fail');
    expect(useChatCue.getState().popup?.prefill).toBe('Help me with Q1');

    const blockedIntro = useChatCue.getState().showPopup({ kind: 'intro', textKey: 'chat.popup.intro2' });
    expect(blockedIntro).toBeNull();
    expect(useChatCue.getState().popup?.id).toBe(failId);
  });

  it('dismisses safely by id and by fail kind', () => {
    const first = useChatCue.getState().showPopup({ kind: 'intro', textKey: 'chat.popup.intro1' })!;
    const second = useChatCue.getState().showPopup({ kind: 'fail', textKey: 'chat.popup.failMission' })!;

    useChatCue.getState().dismissPopup(first);
    expect(useChatCue.getState().popup?.id).toBe(second);

    useChatCue.getState().dismissFail();
    expect(useChatCue.getState().popup).toBeNull();

    useChatCue.getState().showPopup({ kind: 'intro', textKey: 'chat.popup.intro1' });
    useChatCue.getState().dismissFail();
    expect(useChatCue.getState().popup?.kind).toBe('intro');
  });

  it('opens chat with optional prefill and consumes the request once', () => {
    useChatCue.getState().showPopup({ kind: 'fail', textKey: 'chat.popup.failQuiz', prefill: 'Explain Mars dust' });
    useChatCue.getState().openChat('Explain Mars dust');

    const state = useChatCue.getState();
    expect(state.popup).toBeNull();
    expect(state.openReq?.prefill).toBe('Explain Mars dust');

    useChatCue.getState().consumeOpenReq(state.openReq!.id + 1);
    expect(useChatCue.getState().openReq).not.toBeNull();

    useChatCue.getState().consumeOpenReq(state.openReq!.id);
    expect(useChatCue.getState().openReq).toBeNull();
  });
});
