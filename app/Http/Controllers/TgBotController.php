<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Stock;
use App\Models\Test;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);
        $reponse = $this->request;
        $this->record($reponse);

        date_default_timezone_set("Asia/Taipei");

        if (isset($reponse['signal'])) {
            
            $this->axe_send($reponse);

        } else {

            $reponse['ticker']  = str_replace([".P"], [""], $reponse['ticker']);

            $mode = "";
            switch ($reponse['mode']) {
                case "PD":
                    $mode = "底背離";
                    $sense = "做多";
                    break;
                case "ND":
                    $mode = "頂背離";
                    $sense = "做空";
                    break;
                case "PDH":
                    $mode = "隱性底背離";
                    $sense = "待定";
                    break;
                case "NDH":
                    $mode = "隱性頂背離";
                    $sense = "待定";
                    break;
                }
    
            $this->send($reponse, $mode, $sense);
        }
        
    }


    // send message
    protected function send($reponse, $mode, $sense) {

        if ($reponse['ticker'] == "VIX") {

            $message = "
！！ VIX ！！
=========================
警報類型 : VIX
操作方向 : " . $sense . "
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "
";
        } else {
            
        $message = $reponse['ticker'] . " " . $reponse['type'] . " " . $mode . "
=========================
警報類型 : " . $reponse['kind'] . "
操作方向 : " . $sense . "
當前價格 : " . $reponse['close'] . "
發送時間 : " . date("Y-m-d H:i:s") . "
!!! 注意重繪 !!!

Binance : https://www.binance.com/zh-TC/futures/" . $reponse['ticker'] . "
";
        
        }

        // 我自已 測試用
        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=545205414&text=" . urlencode($message));
        
        // 群
        // file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=-4264595778&text=" . urlencode($message));


    }

    // axe send message
    protected function axe_send($reponse) {

        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=6608374257&text=" . urlencode($reponse));
        // sri group -4127267982
       // file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=-4127267982&text=" . urlencode($reponse));
    }

    // request 紀錄
    protected function record($reponse) {
        Test::create([
            "data" => json_encode($reponse)
        ]);
    } 

    /////////////////////////////////////////
}
