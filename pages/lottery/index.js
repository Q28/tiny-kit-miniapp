Page({
  data: {
    options: [
      { id: 1, value: "火锅" },
      { id: 2, value: "烧烤" },
      { id: 3, value: "日料" },
      { id: 4, value: "麻辣烫" }
    ],
    nextId: 5,
    result: "",
    history: []
  },

  onOptionInput(e) {
    const { id } = e.currentTarget.dataset;
    const value = e.detail.value;
    const options = this.data.options.map((item) =>
      item.id === Number(id) ? { ...item, value } : item
    );

    this.setData({ options });
  },

  onAddOption() {
    const { options, nextId } = this.data;
    this.setData({
      options: [...options, { id: nextId, value: "" }],
      nextId: nextId + 1
    });
  },

  deleteOptionById(id) {
    const options = this.data.options.filter((item) => item.id !== Number(id));

    if (!options.length) {
      wx.showToast({
        title: "至少保留一个选项",
        icon: "none"
      });
      return;
    }

    this.setData({ options });
  },

  onLongPressDelete(e) {
    const { id } = e.currentTarget.dataset;
    const target = this.data.options.find((item) => item.id === Number(id));
    const name = (target && target.value && target.value.trim()) || "该选项";

    wx.showModal({
      title: "删除选项",
      content: `确认删除“${name}”？`,
      confirmColor: "#ff4d4f",
      success: (res) => {
        if (!res.confirm) return;
        this.deleteOptionById(Number(id));
      }
    });
  },

  onDraw() {
    const { options, history } = this.data;
    const validOptions = options.map((item) => item.value.trim()).filter(Boolean);

    if (!validOptions.length) {
      wx.showToast({
        title: "请先输入候选项",
        icon: "none"
      });
      return;
    }

    const randomIndex = Math.floor(Math.random() * validOptions.length);
    const picked = validOptions[randomIndex];
    const nextHistory = [picked, ...history].slice(0, 10);

    this.setData({
      result: picked,
      history: nextHistory
    });
  },

  onReset() {
    this.setData({
      options: [{ id: 1, value: "" }],
      nextId: 2,
      result: "",
      history: []
    });
  }
});
