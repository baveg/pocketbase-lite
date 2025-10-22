export const retry = async <T>(createPromise: () => Promise<T>, retry = 2): Promise<T> => {
  let error: any;
  for (let i = 0; i < retry; i++) {
    try {
      return await createPromise();
    } catch (e) {
      error = e;
    }
  }
  throw error;
};
