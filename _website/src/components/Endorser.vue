<template>
  <div class="datatable">
    <span style="color:#fff">Each user will give you the <b>reward</b> if you interact with the <b>endorsed</b> user or tag.</span><br><br>
    <table class="table-dark">
      <thead>
        <tr>
          <th class="text-left" scope="col">User</th>
          <th class="text-left" scope="col">Endorsed</th>
          <th class="text-left" scope="col">Rewards</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="endorser in endorsers" v-bind:key="endorser.user+endorser.searcher">
          <td class="text-left">{{ endorser.user }}</td>
          <td class="text-left">{{ endorser.searcher }}</td>
          <td class="text-left">{{ endorser.tip }} {{ endorser.coin }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
const axios = require("axios");
export default {
  name: "Endorsers",
  data() {
    return {
      endorsers: {}
    };
  },
  async mounted() {
    window.scrollTo(0, 0);
    const app = this
    let endorsers = await axios.get('/endorsements')
    app.endorsers = endorsers.data
  }
};
</script>


