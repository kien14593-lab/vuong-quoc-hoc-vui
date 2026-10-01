import { MiniGame } from './base';

/**
 * Trò chơi tạm (hỏi – đáp bằng nút) dùng khi một trò chơi chưa được làm xong.
 * Bảo đảm mọi mục trong sảnh đều chơi được.
 */
export class QuizStub extends MiniGame {
  private host3d = this.model('npc_rabbit', undefined, [0, 0, 0], 0, 1.6);

  protected build(): void {
    this.ground('#a8dc8a', 120, 120);
    this.model('fountain', undefined, [-6, 0, -6]);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      this.model(i % 3 === 0 ? 'tree_round' : i % 3 === 1 ? 'tree_pine' : 'bush', { seed: i }, [Math.cos(a) * 14, 0, Math.sin(a) * 10 - 6]);
    }
    this.view([0, 4.5, 11], [0, 2.2, 0], 40);
  }

  protected async play(): Promise<void> {
    while (this.more) {
      const st = this.anim(this.host3d);
      if (st) st.talk = true;
      const round = this.ask(this.question(), { buttons: true, visual: true });
      await round.done;
      if (st) {
        st.talk = false;
        st.happy = 1;
      }
      this.fx.burst('star', [0, 3, 0], { count: 24 });
      await this.wait(0.6);
      if (st) st.happy = 0;
      if (!(await this.nextRound())) break;
    }
  }
}
