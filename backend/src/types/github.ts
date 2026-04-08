export interface PullRequestEvent {
  action: 'opened' | 'synchronize' | 'closed' | 'reopened';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string;
    head: {
      ref: string;
      sha: string;
      repo: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
    base: {
      ref: string;
      sha: string;
      repo: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
}