class SelectionBanner {
    constructor(bannerId = 'map-selection-banner') {
        this.$banner = $(`#${bannerId}`);
        this.$text = this.$banner.find('#banner-text');
        this.$confirmBtn = this.$banner.find('#btn-banner-confirm');
        this.$cancelBtn = this.$banner.find('#btn-banner-cancel');

        this._onConfirm = null;
        this._onCancel = null;

        // Bound ONCE, ever. Different flows just swap the callbacks below.
        this.$confirmBtn.on('click', () => {
            if (typeof this._onConfirm === 'function') this._onConfirm();
        });

        this.$cancelBtn.on('click', () => {
            if (typeof this._onCancel === 'function') this._onCancel();
        });
    }

    /**
     * @param {Object} opts
     * @param {string} opts.text 
     * @param {Function} [opts.onConfirm] 
     * @param {Function} [opts.onCancel] 
     * @param {boolean} [opts.showConfirm=true]
     */
    show({ text = '', onConfirm = null, onCancel = null, showConfirm = true } = {}) {
        this._onConfirm = onConfirm;
        this._onCancel = onCancel;

        this.setText(text);
        this.showConfirm(showConfirm);
        this.$banner.removeClass('hidden');
    }

    hide() {
        this.$banner.addClass('hidden');
        this._onConfirm = null;
        this._onCancel = null;
    }

    setText(text) {
        this.$text.text(text);
    }

    showConfirm(show) {
        this.$confirmBtn.toggleClass('hidden', !show);
    }
}

const Banner = new SelectionBanner();
export default Banner;